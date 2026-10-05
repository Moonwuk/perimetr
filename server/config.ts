import {resolve} from 'node:path';
export type ServerConfig = {
 host: string; port: number; publicOrigin: string; databasePath: string; staticDir: string; migrationsDir: string;
 trustProxy: boolean; metricsExportToken?: string; apiLimit: number; admissionLimit: number;
};
function integer(value: string | undefined, fallback: number, name: string, max: number): number {
 if (value === undefined) return fallback;
 if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) throw new Error(`Invalid ${name}`);
 return Number(value);
}
export function readConfig(env: NodeJS.ProcessEnv, bundleDirectory: string): ServerConfig {
 const port = integer(env.PORT, 8080, 'PORT', 65535), production = env.NODE_ENV === 'production';
 if (production && !env.PUBLIC_ORIGIN) throw new Error('PUBLIC_ORIGIN is required in production');
 let origin: URL;
 try { origin = new URL(env.PUBLIC_ORIGIN || `http://127.0.0.1:${port}`); } catch { throw new Error('PUBLIC_ORIGIN must be an absolute origin'); }
 const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
 if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && local && !production))) throw new Error('PUBLIC_ORIGIN must be a bare HTTPS origin (HTTP loopback is allowed only in development)');
 if (env.TRUST_PROXY !== undefined && env.TRUST_PROXY !== '0' && env.TRUST_PROXY !== '1') throw new Error('TRUST_PROXY must be 0 or 1');
 if (env.METRICS_EXPORT_TOKEN && env.METRICS_EXPORT_TOKEN.trim().length < 24) throw new Error('METRICS_EXPORT_TOKEN must contain at least 24 characters');
 return {
  host: env.HOST || '127.0.0.1', port, publicOrigin: origin.origin,
  databasePath: env.DATABASE_PATH || '/data/perimeter.sqlite',
  staticDir: resolve(env.STATIC_DIR || resolve(bundleDirectory, 'public')),
  migrationsDir: resolve(env.MIGRATIONS_DIR || resolve(bundleDirectory, 'drizzle')),
  trustProxy: env.TRUST_PROXY === '1', metricsExportToken: env.METRICS_EXPORT_TOKEN,
  apiLimit: integer(env.API_REQUESTS_PER_MINUTE, 600, 'API_REQUESTS_PER_MINUTE', 100_000),
  admissionLimit: integer(env.ROOM_ADMISSIONS_PER_MINUTE, 12, 'ROOM_ADMISSIONS_PER_MINUTE', 10_000),
 };
}
