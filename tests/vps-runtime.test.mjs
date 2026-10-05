import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm, symlink, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {request as httpRequest} from 'node:http';
import {SqliteDatabase} from '../server/database.ts';
import {MemoryLimiter} from '../server/limiter.ts';
import {readConfig} from '../server/config.ts';
import {clientAddress} from '../server/proxy.ts';
import {createAssets, safePath} from '../server/assets.ts';
import {createHttpServer} from '../server/http.ts';

const temporary = async t => {
 const directory = await mkdtemp(join(tmpdir(), 'perimeter-vps-'));
 t.after(() => rm(directory, {recursive: true, force: true}));
 return directory;
};

test('SQLite migrations run once, preserve rooms on restart, and use WAL with private files', async t => {
 const directory = await temporary(t), path = join(directory, 'db', 'perimeter.sqlite');
 let db = new SqliteDatabase(path);
 assert.equal(db.migrate(resolve('drizzle')).length, 4);
 await db.prepare('INSERT INTO rooms (code,state,host_hash,expires_at) VALUES (?,?,?,?)').bind('TEST123', '{}', 'secret-hash', 42).run();
 assert.equal(await db.prepare('PRAGMA journal_mode').first('journal_mode'), 'wal');
 assert.equal((await stat(path)).mode & 0o777, 0o600);
 db.close(); db = new SqliteDatabase(path);
 try {
  assert.deepEqual(db.migrate(resolve('drizzle')), []);
  assert.equal((await db.prepare('SELECT * FROM rooms WHERE code = ?').bind('TEST123').first()).host_hash, 'secret-hash');
  assert.equal((await db.prepare('SELECT * FROM rooms').all()).results.length, 1);
 } finally { db.close(); }
});

test('batch rollback is atomic and concurrent batches cannot enter each other’s transactions', async () => {
 const db = new SqliteDatabase(':memory:');
 try {
  db.connection.exec('CREATE TABLE counter (id INTEGER PRIMARY KEY, value INTEGER NOT NULL)');
  await assert.rejects(db.batch([db.prepare('INSERT INTO counter VALUES (1,10)'), db.prepare('INSERT INTO counter VALUES (1,20)')]));
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM counter').first('n'), 0);
  await db.prepare('INSERT INTO counter VALUES (1,0)').run();
  const results = await Promise.all(Array.from({length: 20}, () => db.batch([db.prepare('UPDATE counter SET value = value + 1 WHERE id = 1'), db.prepare('SELECT value FROM counter')])));
  assert.equal(await db.prepare('SELECT value FROM counter').first('value'), 20);
  assert.deepEqual(results.map(result => result[1].results[0].value), Array.from({length: 20}, (_, index) => index + 1));
  const deletion = await db.prepare('DELETE FROM counter WHERE id = ? RETURNING *').bind(1).first();
  assert.deepEqual(deletion, {id: 1, value: 20});
  assert.equal(await db.prepare('SELECT * FROM counter').first(), null);
 } finally { db.close(); }
});

test('a failed migration rolls back all pending schema changes and changed applied SQL is rejected', async t => {
 const directory = await temporary(t), db = new SqliteDatabase(':memory:');
 try {
  await writeFile(join(directory, '0000_base.sql'), 'CREATE TABLE preserved (value TEXT);');
  await writeFile(join(directory, '0001_fail.sql'), 'CREATE TABLE partial (value TEXT); INSERT INTO missing VALUES (1);');
  assert.throws(() => db.migrate(directory));
  assert.equal(await db.prepare("SELECT name FROM sqlite_master WHERE name IN ('preserved','partial')").first(), null);
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM _perimeter_migrations').first('n'), 0);
  await writeFile(join(directory, '0001_fail.sql'), 'CREATE TABLE partial (value TEXT);');
  assert.equal(db.migrate(directory).length, 2);
  await writeFile(join(directory, '0000_base.sql'), 'CREATE TABLE tampered (value TEXT);');
  assert.throws(() => db.migrate(directory), /Applied migration changed/);
 } finally { db.close(); }
});

test('bounded limiter retains active limits, refuses new keys at capacity, and recovers after expiry', async () => {
 let clock = 100;
 const limiter = new MemoryLimiter(2, 1000, 2, () => clock);
 assert.equal((await limiter.limit({key: 'a'})).success, true);
 assert.equal((await limiter.limit({key: 'a'})).success, true);
 assert.equal((await limiter.limit({key: 'a'})).success, false);
 assert.equal((await limiter.limit({key: 'b'})).success, true);
 assert.equal((await limiter.limit({key: 'c'})).success, false);
 assert.equal(limiter.size, 2);
 clock += 1001;
 assert.equal((await limiter.limit({key: 'c'})).success, true);
 assert.equal(limiter.size, 1);
});

test('production configuration requires canonical HTTPS origin and validates sensitive settings', () => {
 const bundle = '/opt/perimeter';
 assert.throws(() => readConfig({NODE_ENV: 'production'}, bundle), /PUBLIC_ORIGIN/);
 for (const origin of ['http://game.test', 'http://127.0.0.1:8080', 'https://game.test/path', 'https://user:pass@game.test', 'https://game.test?key=1', 'https://game.test#hash']) assert.throws(() => readConfig({NODE_ENV: 'production', PUBLIC_ORIGIN: origin}, bundle));
 const config = readConfig({NODE_ENV: 'production', PUBLIC_ORIGIN: 'https://game.test'}, bundle);
 assert.equal(config.host, '127.0.0.1'); assert.equal(config.port, 8080); assert.equal(config.trustProxy, false);
 assert.equal(config.staticDir, '/opt/perimeter/public'); assert.equal(config.migrationsDir, '/opt/perimeter/drizzle');
 assert.equal(readConfig({}, bundle).publicOrigin, 'http://127.0.0.1:8080');
 for (const extra of [{PORT: '-1'}, {TRUST_PROXY: 'yes'}, {API_REQUESTS_PER_MINUTE: '0'}, {METRICS_EXPORT_TOKEN: 'short'}]) assert.throws(() => readConfig(extra, bundle));
});

test('forwarded IP is trusted only behind an explicitly enabled private proxy, never a forged prefix', () => {
 assert.equal(clientAddress('203.0.113.2', '198.51.100.1', true), '203.0.113.2');
 assert.equal(clientAddress('127.0.0.1', '198.51.100.1', false), '127.0.0.1');
 assert.equal(clientAddress('::ffff:172.18.0.4', 'fake, 198.51.100.1', true), '198.51.100.1');
 assert.equal(clientAddress('::1', '198.51.100.1, 203.0.113.2', true), '203.0.113.2');
 assert.equal(clientAddress('10.0.0.2', 'not-an-ip', true), '10.0.0.2');
 assert.equal(clientAddress('fd00::2', '2001:db8::1', true), '2001:db8::1');
});

test('static serving blocks traversal, private files and symlink escapes; HTML is revalidated', async t => {
 const directory = await temporary(t), root = join(directory, 'public');
 await mkdir(join(root, 'assets'), {recursive: true});
 await writeFile(join(root, 'index.html'), '<h1>Contour</h1>');
 await writeFile(join(root, 'assets', 'test-ab123.js'), 'console.log(1)');
 await writeFile(join(root, '_headers'), 'internal policy');
 await writeFile(join(directory, 'private.txt'), 'secret');
 await symlink(join(directory, 'private.txt'), join(root, 'leak.txt'));
 const assets = await createAssets(root), request = (path, init = {}) => assets.fetch(new Request('https://game.test' + path, init));
 for (const path of ['/../private.txt', '/%2e%2e/private.txt', '/%5cprivate.txt', '/%00', '/.env', '/%ZZ']) assert.equal(safePath(path), null);
 let response = await request('/'); assert.equal(response.status, 200); assert.equal(await response.text(), '<h1>Contour</h1>');
 assert.equal(response.headers.get('Cache-Control'), 'no-cache'); assert(response.headers.get('Content-Security-Policy').includes("frame-ancestors 'none'"));
 const etag = response.headers.get('ETag'); assert.equal((await request('/', {headers: {'If-None-Match': etag}})).status, 304);
 assert.equal((await request('/leak.txt')).status, 404); assert.equal((await request('/_headers')).status, 400);
 assert.equal((await request('/absent.js', {headers: {Accept: 'text/html'}})).status, 404);
 assert.equal((await request('/room', {headers: {Accept: 'text/html'}})).status, 200);
 response = await request('/assets/test-ab123.js'); assert.equal(response.headers.get('Content-Type'), 'text/javascript; charset=utf-8'); assert.match(response.headers.get('Cache-Control'), /immutable/);
 assert.equal(await (await request('/', {method: 'HEAD'})).text(), '');
 assert.equal((await request('/', {method: 'POST'})).status, 405);
 await rm(join(root, 'index.html'));
 await symlink(join(directory, 'private.txt'), join(root, 'index.html'));
 await assert.rejects(createAssets(root), /within STATIC_DIR/);
});

function rawRequest(port, path, {method = 'GET', headers = {}, body} = {}) {
 return new Promise((resolve, reject) => {
  const request = httpRequest({host: '127.0.0.1', port, path, method, headers}, response => {
   const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => resolve({status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString()}));
  });
  request.on('error', reject); request.end(body);
 });
}

test('HTTP adapter ignores forged edge headers, preserves canonical origin and bounds real request bodies', async t => {
 const seen = [], config = readConfig({PUBLIC_ORIGIN: 'https://game.test'}, '/unused');
 const server = createHttpServer(config, async request => { seen.push({url: request.url, ip: request.headers.get('cf-connecting-ip'), body: await request.text()}); return Response.json({ok: true}); });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 t.after(() => new Promise(resolve => server.close(resolve)));
 const port = server.address().port;
 let response = await rawRequest(port, '/api/rooms?code=TEST123', {headers: {Host: 'evil.test', 'CF-Connecting-IP': '198.51.100.1', 'X-Forwarded-For': '198.51.100.2'}});
 assert.equal(response.status, 200); assert.deepEqual(seen[0], {url: 'https://game.test/api/rooms?code=TEST123', ip: '127.0.0.1', body: ''});
 response = await rawRequest(port, '/api/rooms', {method: 'POST', body: 'a'.repeat(4097), headers: {'Content-Length': '4097', Origin: 'https://appassets.androidplatform.net'}});
 assert.equal(response.status, 413); assert.equal(response.headers['access-control-allow-origin'], 'https://appassets.androidplatform.net');
 response = await rawRequest(port, '/api/rooms', {method: 'POST', body: 'b'.repeat(4097), headers: {'Transfer-Encoding': 'chunked'}});
 assert.equal(response.status, 413);
 response = await rawRequest(port, '/api/rooms', {method: 'POST', body: '{}', headers: {'Content-Type': 'application/json'}});
 assert.equal(response.status, 200); assert.equal(seen.at(-1).body, '{}');
 for (const path of ['/%2e%2e/secret', '//evil.test/api/rooms', '/%ZZ']) assert.equal((await rawRequest(port, path)).status, 400);
 assert.equal(seen.length, 2);
 assert.equal(server.maxHeadersCount, 64); assert.equal(server.requestTimeout, 15_000);
});
