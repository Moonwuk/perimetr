import {DatabaseSync, backup} from 'node:sqlite';
import {chmod, copyFile, rename, rm, stat} from 'node:fs/promises';
import {join, resolve} from 'node:path';

// manage.sh first stops both database users. Do not run this while the app is alive.
if (process.env.CONFIRM_RESTORE !== '1') throw new Error('Restore requires stopped app/backups and CONFIRM_RESTORE=1');
const name = process.argv[2];
if (!/^(?:perimeter|before-restore)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.sqlite$/.test(name || '')) throw new Error('Choose an existing perimeter-*.sqlite or before-restore-*.sqlite snapshot filename');
const databasePath = resolve(process.env.DATABASE_PATH || '/data/perimeter.sqlite');
const backupDir = resolve(process.env.BACKUP_DIR || '/backups');
const sourcePath = join(backupDir, name);
const source = new DatabaseSync(sourcePath, {readOnly: true});
try {
  const rows = source.prepare('PRAGMA quick_check').all();
  if (rows.length !== 1 || Object.values(rows[0])[0] !== 'ok') throw new Error('Snapshot integrity check failed');
  if (!source.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rooms'").get()) throw new Error('Snapshot does not contain the rooms table');
} finally { source.close(); }
let exists = true;
try { await stat(databasePath); }
catch (error) { if (error.code === 'ENOENT') exists = false; else throw error; }
if (exists) {
  const previous = new DatabaseSync(databasePath, {readOnly: true});
  const safetyPath = join(backupDir, `before-restore-${new Date().toISOString().replaceAll(':', '-').replace('.', '-')}.sqlite`);
  try {
    await backup(previous, safetyPath);
    const standalone = new DatabaseSync(safetyPath);
    try { standalone.exec('PRAGMA journal_mode = DELETE'); }
    finally { standalone.close(); }
    await chmod(safetyPath, 0o600);
  }
  finally { previous.close(); }
}
const temporary = `${databasePath}.restore-${process.pid}`;
try {
  await copyFile(sourcePath, temporary);
  await chmod(temporary, 0o600);
  await rm(`${databasePath}-wal`, {force: true});
  await rm(`${databasePath}-shm`, {force: true});
  await rename(temporary, databasePath);
} finally { await rm(temporary, {force: true}); }
console.log(`restore_ok ${name}`);
