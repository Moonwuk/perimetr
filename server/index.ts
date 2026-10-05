import {fileURLToPath} from 'node:url';
import worker, {type Env} from '../cloudflare/worker';
import {SqliteDatabase} from './database';
import {readConfig} from './config';
import {createAssets} from './assets';
import {MemoryLimiter} from './limiter';
import {createHttpServer} from './http';
import {configureRuntime} from './runtime-env';

const config = readConfig(process.env, fileURLToPath(new URL('.', import.meta.url)));
const database = new SqliteDatabase(config.databasePath);
try {
 const migrations = database.migrate(config.migrationsDir);
 if (migrations.length) console.info(`perimeter_migrations_applied count=${migrations.length}`);
 const assets = await createAssets(config.staticDir);
 const runtime = {
  DB: database as unknown as D1Database,
  ASSETS: assets as Fetcher,
  API_LIMITER: new MemoryLimiter(config.apiLimit),
  ADMISSION_LIMITER: new MemoryLimiter(config.admissionLimit),
  METRICS_EXPORT_TOKEN: config.metricsExportToken,
 } satisfies Env;
 configureRuntime(runtime);
 const server = createHttpServer(config, request => worker.fetch(request, runtime));
 let stopping = false, cleanup: Promise<void> | undefined;
 const runCleanup = () => {
  if (stopping || cleanup) return;
  cleanup = worker.scheduled({} as ScheduledController, runtime).catch(() => { console.error('perimeter_cleanup_failed'); }).finally(() => { cleanup = undefined; });
 };
 // One maintenance timer per process, independent of number of rooms.
 const timer = setInterval(runCleanup, 60 * 60 * 1000);
 timer.unref();
 const stop = () => {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  const timeout = setTimeout(() => { server.closeAllConnections(); }, 10_000);
  timeout.unref();
  server.close(async () => {
   clearTimeout(timeout);
   await cleanup;
   database.close();
   console.info('perimeter_stopped');
  });
 };
 process.once('SIGTERM', stop);
 process.once('SIGINT', stop);
 server.once('error', error => {
  clearInterval(timer);
  console.error('perimeter_listen_failed', (error as NodeJS.ErrnoException).code || 'unknown');
  database.close();
  process.exitCode = 1;
 });
 server.listen(config.port, config.host, () => {
  console.info(`perimeter_ready host=${config.host} port=${config.port}`);
  runCleanup();
 });
} catch (error) {
 database.close();
 throw error;
}
