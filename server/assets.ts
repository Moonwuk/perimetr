import {readFile, realpath, stat} from 'node:fs/promises';
import {extname, resolve, sep} from 'node:path';
export const securityHeaders = {
 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
};
const mime: Record<string, string> = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4'};
export function safePath(pathname: string): string | null {
 let decoded: string;
 try { decoded = decodeURIComponent(pathname); } catch { return null; }
 if (!decoded.startsWith('/') || decoded.includes('\\') || /[\x00-\x1f\x7f]/.test(decoded)) return null;
 if (decoded.split('/').some(part => part === '..' || part.startsWith('.'))) return null;
 if (decoded.split('/').some(part => part === '_headers' || part === '_redirects')) return null;
 return decoded;
}
export async function createAssets(directory: string): Promise<{fetch(request: Request): Promise<Response>}> {
 const root = await realpath(directory);
 const index = await realpath(resolve(root, 'index.html'));
 if (!index.startsWith(root + sep) || !(await stat(index)).isFile()) throw new Error('Built frontend index.html must be a file within STATIC_DIR');
 const failure = (status: number, text: string, extra: Record<string, string> = {}) => new Response(text, {status, headers: {...securityHeaders, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...extra}});
 return {async fetch(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return failure(405, 'Method not allowed', {Allow: 'GET, HEAD'});
  const path = safePath(new URL(request.url).pathname);
  if (path === null) return failure(400, 'Invalid path');
  let filename = resolve(root, '.' + (path === '/' ? '/index.html' : path));
  try {
   const canonical = await realpath(filename);
   if (!canonical.startsWith(root + sep)) return failure(404, 'Not found');
   if (!(await stat(canonical)).isFile()) return failure(404, 'Not found');
   filename = canonical;
  } catch {
   if (extname(path) || !request.headers.get('accept')?.includes('text/html')) return failure(404, 'Not found');
   filename = index;
  }
  try {
   const info = await stat(filename), etag = `W/"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`;
   const headers = {...securityHeaders, 'Content-Type': mime[extname(filename)] || 'application/octet-stream', 'Cache-Control': path.startsWith('/assets/') && extname(filename) !== '.html' ? 'public, max-age=31536000, immutable' : 'no-cache', ETag: etag};
   if (request.headers.get('if-none-match') === etag) return new Response(null, {status: 304, headers});
   if (request.method === 'HEAD') return new Response(null, {headers: {...headers, 'Content-Length': String(info.size)}});
   return new Response(await readFile(filename), {headers});
  } catch { return failure(500, 'Asset unavailable'); }
 }};
}
