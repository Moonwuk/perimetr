import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {safePath, securityHeaders} from './assets.ts';
import {clientAddress} from './proxy.ts';
import {withApiCors} from '../lib/server/api-origin.ts';
import type {ServerConfig} from './config.ts';

class HttpError extends Error {
 status: number;
 constructor(status: number, message: string) { super(message); this.status = status; }
}
const bodyLimit = 4096;
function readBody(request: IncomingMessage): Promise<Buffer> {
 return new Promise((resolve, reject) => {
  const parts: Buffer[] = []; let length = 0;
  const cleanup = () => { clearTimeout(timer); request.off('data', data); request.off('end', end); request.off('error', error); request.off('aborted', aborted); };
  const fail = (reason: Error) => { cleanup(); request.pause(); reject(reason); };
  const data = (part: Buffer) => {
   length += part.length;
   if (length > bodyLimit) { fail(new HttpError(413, 'Request body exceeds 4096 bytes')); return; }
   parts.push(part);
  };
  const end = () => { cleanup(); resolve(Buffer.concat(parts, length)); };
  const error = () => fail(new HttpError(400, 'Request interrupted'));
  const aborted = () => fail(new HttpError(400, 'Request interrupted'));
  const timer = setTimeout(() => fail(new HttpError(408, 'Request timed out')), 10_000);
  timer.unref();
  request.on('data', data); request.once('end', end); request.once('error', error); request.once('aborted', aborted);
 });
}
function headersOf(request: IncomingMessage, config: ServerConfig): Headers {
 const headers = new Headers();
 for (const [name, value] of Object.entries(request.headers)) {
  if (value !== undefined && !['host', 'connection', 'transfer-encoding', 'cf-connecting-ip', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'forwarded'].includes(name)) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
 }
 const forwarded = request.headers['x-forwarded-for'];
 headers.set('CF-Connecting-IP', clientAddress(request.socket.remoteAddress, Array.isArray(forwarded) ? forwarded.join(',') : forwarded, config.trustProxy));
 return headers;
}
async function send(response: ServerResponse, result: Response, method: string): Promise<void> {
 if (response.destroyed) return;
 const headers: Record<string, string> = {...securityHeaders};
 result.headers.forEach((value, name) => { headers[name] = value; });
 const data = method === 'HEAD' || result.status === 204 || result.status === 304 ? undefined : Buffer.from(await result.arrayBuffer());
 if (data) headers['content-length'] = String(data.length);
 response.writeHead(result.status, headers);
 response.end(data);
}
export function createHttpServer(config: ServerConfig, dispatch: (request: Request) => Promise<Response>) {
 const server = createServer({maxHeaderSize: 16_384, headersTimeout: 10_000, requestTimeout: 15_000, keepAliveTimeout: 5_000}, async (incoming, outgoing) => {
  let request: Request | undefined;
  try {
   const target = incoming.url || '/', method = incoming.method || 'GET';
   if (!target.startsWith('/') || target.startsWith('//') || target.includes('#') || safePath(target.split('?')[0]) === null) throw new HttpError(400, 'Invalid request target');
   const url = new URL(target, config.publicOrigin);
   if (url.origin !== config.publicOrigin) throw new HttpError(400, 'Invalid request target');
   const headers = headersOf(incoming, config);
   request = new Request(url, {method, headers});
   const contentLength = incoming.headers['content-length'];
   if (contentLength && Number(contentLength) > bodyLimit) throw new HttpError(413, 'Request body exceeds 4096 bytes');
   if (incoming.headers['content-encoding'] && incoming.headers['content-encoding'] !== 'identity') throw new HttpError(415, 'Unsupported content encoding');
   const body = await readBody(incoming);
   if ((method === 'GET' || method === 'HEAD') && body.length) throw new HttpError(400, 'Unexpected request body');
   if (body.length) request = new Request(url, {method, headers, body: new Uint8Array(body)});
   await send(outgoing, await dispatch(request), method);
  } catch (error) {
   const status = error instanceof HttpError ? error.status : 500;
   if (status === 500) console.error('perimeter_http_unavailable');
   let response = Response.json({error: error instanceof HttpError ? error.message : 'Service temporarily unavailable'}, {status, headers: {'Cache-Control': 'no-store', Connection: 'close'}});
   if (request) response = withApiCors(request, response);
   outgoing.once('finish', () => incoming.destroy());
   try { await send(outgoing, response, incoming.method || 'GET'); } catch { outgoing.destroy(); }
  }
 });
 server.maxHeadersCount = 64;
 server.maxConnections = 2000;
 server.maxRequestsPerSocket = 1000;
 return server;
}
