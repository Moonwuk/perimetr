import {DatabaseSync, backup} from 'node:sqlite';
import {chmod, mkdir, readdir, rename, rm} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {setTimeout} from 'node:timers/promises';

const databasePath = resolve(process.env.DATABASE_PATH || '/data/perimeter.sqlite');
const backupDir = resolve(process.env.BACKUP_DIR || '/backups');
const integer = (name, fallback, maximum) => {
  const value = process.env[name] || String(fallback);
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > maximum) throw new Error(`Invalid ${name}`);
  return Number(value);
};
const keep = integer('BACKUP_KEEP', 28, 1000);
const interval = integer('BACKUP_INTERVAL_HOURS', 6, 168) * 3_600_000;
const timestamp = () => new Date().toISOString().replaceAll(':', '-').replace('.', '-');
const snapshotName = /^perimeter-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.sqlite$/;

async function takeSnapshot() {
  await mkdir(backupDir, {recursive: true, mode: 0o700});
  const name = `perimeter-${timestamp()}.sqlite`;
  const partial = join(backupDir, `.${name}.${process.pid}.partial`);
  let source;
  try {
    source = new DatabaseSync(databasePath, {readOnly: true});
    source.exec('PRAGMA busy_timeout = 5000');
    // SQLite's online backup API includes committed WAL data and keeps a consistent snapshot.
    await backup(source, partial, {rate: 128});
    source.close();
    source = undefined;
    const check = new DatabaseSync(partial);
    try {
      // The source uses WAL. Normalize the snapshot to a standalone file before moving it.
      check.exec('PRAGMA journal_mode = DELETE');
      const result = check.prepare('PRAGMA quick_check').all();
      if (result.length !== 1 || Object.values(result[0])[0] !== 'ok') throw new Error('Backup integrity check failed');
    } finally { check.close(); }
    await chmod(partial, 0o600);
    await rename(partial, join(backupDir, name));
    const snapshots = (await readdir(backupDir)).filter(name => snapshotName.test(name)).sort().reverse();
    await Promise.all(snapshots.slice(keep).map(name => rm(join(backupDir, name))));
    console.log(`backup_ok ${name}`);
  } finally {
    source?.close();
    await rm(partial, {force: true});
    await rm(`${partial}-wal`, {force: true});
    await rm(`${partial}-shm`, {force: true});
  }
}

const mode = process.argv[2] || 'once';
if (!['once', 'loop'].includes(mode)) throw new Error('Usage: backup.mjs [once|loop]');
if (mode === 'once') {
  await takeSnapshot();
} else {
  const controller = new AbortController();
  process.on('SIGTERM', () => controller.abort());
  process.on('SIGINT', () => controller.abort());
  while (!controller.signal.aborted) {
    try { await takeSnapshot(); }
    catch (error) { console.error('backup_failed', error instanceof Error ? error.message : 'Unknown error'); }
    if (!controller.signal.aborted) {
      try { await setTimeout(interval, undefined, {signal: controller.signal}); }
      catch (error) { if (error.name !== 'AbortError') throw error; }
    }
  }
}
