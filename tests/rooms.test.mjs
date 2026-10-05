import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import ts from 'typescript';
import {applyAction,actionStatus,viewGame} from '../lib/game/engine.ts';
const db=new DatabaseSync(':memory:');
for(const file of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())db.exec(await readFile(new URL('../drizzle/'+file,import.meta.url),'utf8'));
// Exercise the production route and SQL against a transactional SQLite-backed D1 adapter.
let beforeRun;
let beforeFirst;
const adapter={prepare(sql){let args=[];return {bind(...v){args=v;return this;},async first(){if(beforeFirst)beforeFirst(sql,args);return db.prepare(sql).get(...args)??null;},run(){if(beforeRun)beforeRun(sql,args);const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}};},async batch(statements){db.exec('BEGIN');try{const out=[];for(const s of statements)out.push(s.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}};
globalThis.__contourRoomTestDb=adapter;
const metricsSource=(await readFile(new URL('../lib/server/metrics.ts',import.meta.url),'utf8')).replace("import { roomDb } from '@/db/rooms';",'const roomDb=()=>globalThis.__contourRoomTestDb;').replace("'@/lib/game/engine'",JSON.stringify(new URL('../lib/game/engine.ts',import.meta.url).href)).replace("'@/lib/server/api-origin'",JSON.stringify(new URL('../lib/server/api-origin.ts',import.meta.url).href));
const metricsUrl='data:text/javascript;base64,'+Buffer.from(ts.transpileModule(metricsSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const source=(await readFile(new URL('../app/api/rooms/route.ts',import.meta.url),'utf8')).replace("import { roomDb } from '@/db/rooms';",'const roomDb=()=>globalThis.__contourRoomTestDb;').replace("'@/lib/game/engine'",JSON.stringify(new URL('../lib/game/engine.ts',import.meta.url).href)).replace("'@/lib/server/api-origin'",JSON.stringify(new URL('../lib/server/api-origin.ts',import.meta.url).href)).replace("'@/lib/server/metrics'",JSON.stringify(metricsUrl));
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {POST,GET,handleRoomPost}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
const req=(b,token,origin='https://game.test')=>new Request('https://game.test/api/rooms',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(b)});
const post=async(b,t,o)=>{const r=await POST(req(b,t,o));return {status:r.status,data:await r.json()};};
const get=async(code,token)=>{const r=await GET(new Request(`https://game.test/api/rooms?code=${code}`,{headers:{Authorization:`Bearer ${token}`}}));return {status:r.status,data:await r.json()};};
const hostSetup={type:'deploy',deployment:{layout:[0,4,20,24,12],shields:[0,0,0,0,0],sensors:[0,0,0,0,0]}};
const guestSetup={type:'deploy',deployment:{layout:[12,6,18,22,10],shields:[0,0,0,0,0],sensors:[0,0,0,0,0]}};
const move=(code,revision,action,token)=>post({intent:'action',code,revision,action},token);

test('public admission limiter cannot be bypassed with an Authorization header',async()=>{
 let checks=0;
 for(const body of [{intent:'create'},{intent:'join',code:'ABCDEFG'},{intent:'find'}]){
  const response=await handleRoomPost(req(body,'invented'),async()=>{checks++;return false;});
  assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'60');
 }
 assert.equal(checks,3);
});

test('request body is limited by bytes and rejects oversized streams without Content-Length',async()=>{
 const unicode=await POST(req({intent:'create',name:'😀'.repeat(1100)}));assert.equal(unicode.status,413);
 let cancelled=false;
 const stream=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(5000).fill(32));},cancel(){cancelled=true;}});
 const response=await POST(new Request('https://game.test/api/rooms',{method:'POST',body:stream,duplex:'half'}));
 assert.equal(response.status,413);assert(cancelled);
 assert.equal((await POST(req([]))).status,400);
});

test('presence polling keeps the revision and avoids repeated writes within 15 seconds',async()=>{
 const h=(await post({intent:'create'})).data;
 db.prepare('UPDATE rooms SET host_seen_at = 1 WHERE code = ?').run(h.code);
 const first=(await get(h.code,h.token)).data;
 const second=(await get(h.code,h.token)).data;
 assert(first.presence[0]>1);assert.equal(first.presence[0],second.presence[0]);
 assert.equal(first.revision,0);assert.equal(second.revision,0);
 const stored=db.prepare('SELECT host_seen_at FROM rooms WHERE code = ?').get(h.code);
 assert.equal(stored.host_seen_at,first.presence[0]);
});

test('joining immediately reports both occupied seats as present',async()=>{
 const host=(await post({intent:'create'})).data;
 const joined=await post({intent:'join',code:host.code});assert.equal(joined.status,200);
 assert(joined.data.presence.every(time=>time>0));
 const stored=db.prepare('SELECT guest_seen_at FROM rooms WHERE code = ?').get(host.code);
 assert.equal(joined.data.presence[1],stored.guest_seen_at);
 assert.equal((await get(host.code,host.token)).data.presence[1],joined.data.presence[1]);
});

test('online lifecycle, deployment, hidden data, concurrent joins, CAS and financial finish',async()=>{
 const created=await post({intent:'create',name:'Host'});assert.equal(created.status,201);const h=created.data;assert.equal(h.game.status,'waiting');assert.match(h.code,/^[A-HJ-NP-Z2-9]{7}$/);assert(h.token);
 assert.equal((await get(h.code,'wrong')).status,403);
 assert.equal((await move(h.code,0,{type:'end'},h.token)).status,400);
 const deployed=await move(h.code,0,hostSetup,h.token);assert.equal(deployed.status,200);assert.equal(deployed.data.revision,1);assert.equal(deployed.data.game.status,'waiting');
 const guests=await Promise.all([post({intent:'join',code:h.code,name:'Guest'}),post({intent:'join',code:h.code,name:'Late'})]);assert.deepEqual(guests.map(x=>x.status).sort(),[200,409]);const guest=guests.find(x=>x.status===200).data;
 assert.equal(guest.game.status,'setup');assert.equal(guest.revision,2);assert.deepEqual(guest.game.players[0].layout,{});
 assert.equal((await move(h.code,2,{type:'end'},h.token)).status,400);
 const started=await move(h.code,2,guestSetup,guest.token);assert.equal(started.status,200);assert.equal(started.data.game.status,'playing');assert.equal(started.data.revision,3);
 assert.equal((await move(h.code,3,{type:'end'},guest.token)).status,400);
 const scout=await move(h.code,3,{type:'card',card:'recon',cell:12,side:'enemy'},h.token);assert.equal(scout.status,200);assert.equal(scout.data.game.ap,2);assert.equal(scout.data.game.players[0].money,280);
 assert.equal((await move(h.code,3,{type:'end'},h.token)).status,409);
 const concurrent=await Promise.all([move(h.code,4,{type:'card',card:'ddos',node:'web',side:'enemy'},h.token),move(h.code,4,{type:'card',card:'ddos',node:'web',side:'enemy'},h.token)]);assert.deepEqual(concurrent.map(x=>x.status).sort(),[200,409]);
 const enemy=await get(h.code,guest.token);assert.equal(enemy.data.revision,5);assert.equal(enemy.data.game.players[1].nodes.web.offline,true);assert.deepEqual(enemy.data.game.players[0].hand,[]);assert.deepEqual(enemy.data.game.players[0].layout,{});assert(!('deck' in enemy.data.game.players[0]));assert(!JSON.stringify(enemy.data).includes(h.token));
 assert.equal((await post({intent:'action',code:h.code,revision:5,action:{type:'end'}},h.token,'https://evil.test')).status,403);
 let room=(await get(h.code,h.token)).data;
 while(room.game.status==='playing'){const t=room.game.turn===0?h.token:guest.token;const result=await move(h.code,room.revision,{type:'end'},t);assert.equal(result.status,200);room=result.data;}
 assert.equal(room.game.round,10);assert.equal(room.game.winner,0);assert.deepEqual(room.game.players.map(p=>p.money),[3040,2050]);
 assert.equal((await move(h.code,room.revision,{type:'end'},h.token)).status,400);
});

test('joining before either setup requires both confirmations, off-turn surrender is allowed',async()=>{
 const h=(await post({intent:'create'})).data,guest=(await post({intent:'join',code:h.code})).data;
 assert.equal(guest.game.status,'setup');const one=await move(h.code,1,guestSetup,guest.token);assert.equal(one.data.game.status,'setup');
 const two=await move(h.code,2,hostSetup,h.token);assert.equal(two.data.game.status,'playing');assert.equal(two.data.game.turn,0);
 const ended=await move(h.code,3,{type:'surrender'},guest.token);assert.equal(ended.status,200);assert.equal(ended.data.game.winner,0);
});

test('malformed input, cross-origin writes and expired rooms are rejected',async()=>{
 const bad=await POST(new Request('https://game.test/api/rooms',{method:'POST',body:'no-json'}));assert.equal(bad.status,400);
 assert.equal((await post({intent:'action',code:'INVALID',action:{type:'card',card:'invented'}})).status,404);
 assert.equal((await post({intent:'create'},null,'https://evil.test')).status,403);
 const x=(await post({intent:'create'})).data;db.prepare('UPDATE rooms SET expires_at = 0 WHERE code = ?').run(x.code);assert.equal((await get(x.code,x.token)).status,404);
});

test('free card exchanges are authorized, once per turn, and protected against replay',async()=>{
 const h=(await post({intent:'create'})).data,guest=(await post({intent:'join',code:h.code})).data;
 await move(h.code,1,hostSetup,h.token);await move(h.code,2,guestSetup,guest.token);
 const action={type:'exchange',card:'ddos',kind:'economy'};
 assert.equal((await move(h.code,3,action,'wrong')).status,403);
 const results=await Promise.all([move(h.code,3,action,h.token),move(h.code,3,action,h.token)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const room=results.find(r=>r.status===200).data;assert.equal(room.game.players[0].money,300);assert.equal(room.game.ap,3);assert.equal(room.game.players[0].hand.length,6);assert.equal(room.game.players[0].exchangeRound,1);assert(!room.game.players[0].hand.includes('ddos'));
 assert.equal((await move(h.code,4,{type:'exchange',card:'recon',kind:'defense'},h.token)).status,400);
 const other=(await get(h.code,guest.token)).data;assert.deepEqual(other.game.players[0].exchangeOptions,{});assert(!other.game.logs.some(l=>l.text.startsWith('Замена:')));
 await move(h.code,4,{type:'end'},h.token);await move(h.code,5,{type:'end'},guest.token);
 assert.equal((await move(h.code,6,{type:'exchange',card:'recon',kind:'defense'},h.token)).status,200);
});


test('PvP server enforces typed counters, damage, hidden setup and a migrated room',async()=>{
 const h=(await post({intent:'create'})).data,guest=(await post({intent:'join',code:h.code})).data;
 await move(h.code,1,hostSetup,h.token);
 const defended={...guestSetup,deployment:{...guestSetup.deployment,shields:[1,0,0,0,0],auth:[0,0,1,0,0],backups:[0,0,0,1,0]}};
 await move(h.code,2,defended,guest.token);
 let state=JSON.parse(db.prepare('SELECT state FROM rooms WHERE code = ?').get(h.code).state);
 state.players[0].hand=['recon','ddos','phishing','operation'];
 db.prepare('UPDATE rooms SET state = ? WHERE code = ?').run(JSON.stringify(state),h.code);
 assert.equal((await get(h.code,h.token)).data.game.players[1].nodes.web,null);
 let r=await move(h.code,3,{type:'card',card:'recon',cell:12,side:'enemy'},h.token);assert.equal(r.status,200);assert.equal(r.data.game.players[1].nodes.web.shield,1);
 r=await move(h.code,4,{type:'card',card:'ddos',node:'web',side:'enemy'},h.token);assert.equal(r.status,200);assert.equal(r.data.game.players[1].nodes.web.shield,0);assert.equal(r.data.game.players[1].money,300);assert.equal(r.data.game.players[1].nodes.web.offline,false);
 assert.equal((await move(h.code,5,{type:'card',card:'phishing',node:'web',side:'enemy'},h.token)).status,400,'Phishing needs an account target, not an arbitrary server');
 r=await move(h.code,5,{type:'card',card:'phishing',node:'workstation',side:'enemy'},h.token);assert.equal(r.status,200);assert.equal(r.data.game.players[1].money,300);assert.equal(r.data.game.players[1].nodes.workstation.access,1);assert.equal(r.data.game.players[0].money,225);assert.equal(r.data.game.ap,0);
 assert.equal((await move(h.code,6,{type:'card',card:'operation',node:'workstation',side:'enemy'},h.token)).status,400);
 state=JSON.parse(db.prepare('SELECT state FROM rooms WHERE code = ?').get(h.code).state);state.version=2;
 for(const p of state.players)for(const n of Object.values(p.nodes)){delete n.auth;delete n.backup;}
 db.prepare('UPDATE rooms SET state = ? WHERE code = ?').run(JSON.stringify(state),h.code);
 const migrated=await get(h.code,h.token);assert.equal(migrated.status,200);assert.equal(migrated.data.game.version,5);assert.equal(migrated.data.game.players[0].money,225);assert.equal(migrated.data.game.players[1].nodes.workstation.access,1);assert.equal(migrated.data.game.players[1].nodes.web.auth,0);
});

test('idempotent admission recovers lost create/join responses without extra rooms or seat theft',async()=>{
 const hostSecret=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join(''),guestSecret=crypto.randomUUID()+crypto.randomUUID();
 const created=await Promise.all([post({intent:'create',seatToken:hostSecret}),post({intent:'create',seatToken:hostSecret})]);assert(created.every(r=>r.status===201||r.status===200));assert.equal(created[0].data.code,created[1].data.code);const h=created[0].data;
 const joined=await Promise.all([post({intent:'join',code:h.code,seatToken:guestSecret}),post({intent:'join',code:h.code,seatToken:guestSecret})]);assert(joined.every(r=>r.status===200));assert.equal(joined[0].data.revision,1);assert.equal(joined[1].data.revision,1);
 const resumed=await post({intent:'join',code:h.code,seatToken:guestSecret});assert.equal(resumed.status,200);assert.equal(resumed.data.game.viewer,1);assert.equal((await post({intent:'join',code:h.code,seatToken:crypto.randomUUID()+crypto.randomUUID()})).status,409);
 assert.equal((await post({intent:'create',seatToken:'short'})).status,400);assert.equal((await post({intent:'join',code:h.code,seatToken:hostSecret})).status,409);
});

test('presence does not change action revision and reconnection returns authoritative state',async()=>{
 const h=(await post({intent:'create'})).data,guest=(await post({intent:'join',code:h.code})).data;
 const before=(await get(h.code,h.token)).data,other=(await get(h.code,guest.token)).data,again=(await get(h.code,h.token)).data;
 assert.equal(before.revision,1);assert.equal(again.revision,1);assert(again.presence.every(t=>t>0));assert(again.serverTime>=again.presence[0]);assert(!JSON.stringify(other).includes(h.token));
 await move(h.code,1,hostSetup,h.token);await move(h.code,2,guestSetup,guest.token);
 const one=await move(h.code,3,{type:'reserve',counter:'auth'},h.token);assert.equal(one.status,200);
 const restored=(await get(h.code,h.token)).data;assert.equal(restored.revision,4);assert.equal(restored.game.players[0].money,270);
 const masked=(await get(h.code,guest.token)).data;assert.equal(masked.game.players[0].reserve,'hidden');assert(!masked.game.logs.some(l=>l.text.startsWith('Дежурство:')));
 const replay=await move(h.code,3,{type:'reserve',counter:'auth'},h.token);assert.equal(replay.status,409);assert.equal(replay.data.game.players[0].money,270);
});

test('network rematch requires both votes, keeps seat authorization and alternates first turn',async()=>{
 const h=(await post({intent:'create'})).data,guest=(await post({intent:'join',code:h.code})).data;
 await move(h.code,1,{type:'surrender'},h.token);
 const first=await move(h.code,2,{type:'rematch'},h.token);assert.equal(first.status,200);assert.equal(first.data.game.status,'finished');
 assert.equal((await move(h.code,3,{type:'rematch'},h.token)).status,400);
 const second=await move(h.code,3,{type:'rematch'},guest.token);assert.equal(second.status,200);assert.equal(second.data.game.status,'setup');assert.equal(second.data.game.firstPlayer,1);assert.equal(second.data.game.matchNumber,2);
 await move(h.code,4,hostSetup,h.token);const begun=await move(h.code,5,guestSetup,guest.token);assert.equal(begun.data.game.turn,1);assert.equal((await get(h.code,h.token)).data.game.viewer,0);assert.equal((await get(h.code,guest.token)).data.game.viewer,1);
});

const secret=()=>crypto.randomUUID()+crypto.randomUUID();
const hidePublicRooms=()=>db.exec("UPDATE rooms SET visibility = 'private'");

test('rooms are private by default and visibility is an explicit validated choice',async()=>{
 hidePublicRooms();
 const host=(await post({intent:'create',seatToken:secret()})).data;
 assert.equal(host.visibility,'private');assert.equal((await get(host.code,host.token)).data.visibility,'private');
 assert.equal((await post({intent:'find',seatToken:secret()})).status,404);
 assert.equal((await post({intent:'create',visibility:'listed'})).status,400);
 for(const b of [{intent:'find',seatToken:'short'},{intent:'find',excludeCode:'%invalid'},{intent:'find',excludeCode:7}])assert.equal((await post(b)).status,400);
 assert.equal((await post({intent:'find'},undefined,'https://evil.test')).status,403);
 assert.equal((await post({intent:'join',code:host.code})).status,200,'Private rooms still work by invitation code');
});

test('find only admits active, unoccupied, unexpired public waiting rooms and hides private data',async()=>{
 hidePublicRooms();
 const stale=(await post({intent:'create',visibility:'public'})).data;
 db.prepare('UPDATE rooms SET host_seen_at = ? WHERE code = ?').run(Date.now()-61_000,stale.code);
 const ended=(await post({intent:'create',visibility:'public'})).data;
 await move(ended.code,0,{type:'surrender'},ended.token);
 const full=(await post({intent:'create',visibility:'public'})).data;
 await post({intent:'join',code:full.code});
 const expired=(await post({intent:'create',visibility:'public'})).data;
 db.prepare('UPDATE rooms SET expires_at = 0 WHERE code = ?').run(expired.code);
 assert.equal((await post({intent:'find',seatToken:secret()})).status,404);
 const available=(await post({intent:'create',name:'Available',visibility:'public'})).data;
 const result=await post({intent:'find',name:'<Guest>',seatToken:secret()});assert.equal(result.status,200);
 assert.equal(result.data.code,available.code);assert.equal(result.data.visibility,'public');assert.equal(result.data.game.viewer,1);
 assert.equal(result.data.game.status,'setup');assert.equal(result.data.game.players[1].name,'Guest');
 assert.deepEqual(result.data.game.players[0].layout,{});assert.deepEqual(result.data.game.players[0].hand,[]);
 assert(!JSON.stringify(result.data).includes(available.token));assert(result.data.presence.every(x=>x>0));
 assert.equal((await post({intent:'find',seatToken:secret()})).status,404);
 await get(stale.code,stale.token);
 const reactivated=await post({intent:'find',seatToken:secret()});assert.equal(reactivated.status,200);assert.equal(reactivated.data.code,stale.code);
});

test('find excludes the current room and cannot match its own host token',async()=>{
 hidePublicRooms();
 const host=(await post({intent:'create',visibility:'public',seatToken:secret()})).data;
 assert.equal((await post({intent:'find',seatToken:host.token})).status,404);
 assert.equal((await post({intent:'find',seatToken:secret(),excludeCode:host.code})).status,404);
 assert.equal((await post({intent:'find',seatToken:secret()})).data.code,host.code);
});

test('concurrent find requests cannot occupy the same seat and retry another candidate',async()=>{
 hidePublicRooms();
 const host=(await post({intent:'create',visibility:'public'})).data;
 const results=await Promise.all([post({intent:'find',seatToken:secret()}),post({intent:'find',seatToken:secret()})]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,404]);
 assert.equal(results.find(r=>r.status===200).data.code,host.code);
 const second=(await post({intent:'create',visibility:'public'})).data;
 const third=(await post({intent:'create',visibility:'public'})).data;
 const retries=await Promise.all([post({intent:'find',seatToken:secret()}),post({intent:'find',seatToken:secret()})]);
 assert(retries.every(r=>r.status===200));assert.deepEqual(retries.map(r=>r.data.code).sort(),[second.code,third.code].sort());
});

test('a lost find response recovers the same room even after play starts',async()=>{
 hidePublicRooms();
 const host=(await post({intent:'create',visibility:'public'})).data,seat=secret();
 await move(host.code,0,hostSetup,host.token);
 const first=await post({intent:'find',name:'Original guest',seatToken:seat});assert.equal(first.status,200);
 await move(host.code,first.data.revision,guestSetup,seat);
 const retry=await post({intent:'find',name:'Replacement',seatToken:seat});assert.equal(retry.status,200);
 assert.equal(retry.data.code,host.code);assert.equal(retry.data.game.status,'playing');assert.equal(retry.data.game.players[1].name,'Original guest');assert.equal(retry.data.revision,3);
});

test('simultaneous find retries with the same token cannot claim different rooms',async()=>{
 hidePublicRooms();
 const one=(await post({intent:'create',visibility:'public'})).data,two=(await post({intent:'create',visibility:'public'})).data,seat=secret();
 // Different exclusions force both in-flight calls to read different candidates.
 const results=await Promise.all([post({intent:'find',seatToken:seat,excludeCode:one.code}),post({intent:'find',seatToken:seat,excludeCode:two.code})]);
 assert(results.every(r=>r.status===200));assert.equal(results[0].data.code,results[1].data.code);
 const remaining=await post({intent:'find',seatToken:secret()});assert.equal(remaining.status,200);assert.notEqual(remaining.data.code,results[0].data.code);
});

test('closing is host-only, deletes both seats and prevents actions, joins and recovery',async()=>{
 hidePublicRooms();
 const host=(await post({intent:'create',visibility:'public'})).data,guest=(await post({intent:'find',seatToken:secret()})).data;
 for(const token of [undefined,'wrong',secret(),guest.token])assert.equal((await post({intent:'close',code:host.code},token)).status,403);
 assert.equal((await post({intent:'close',code:host.code},host.token,'https://evil.test')).status,403);
 assert.equal((await get(host.code,host.token)).status,200);
 const closed=await post({intent:'close',code:host.code},host.token);assert.equal(closed.status,200);assert.deepEqual(closed.data,{closed:true,code:host.code});
 assert.equal(db.prepare('SELECT code FROM rooms WHERE code = ?').get(host.code),undefined);
 for(const token of [host.token,guest.token]){const r=await get(host.code,token);assert.equal(r.status,404);assert.match(r.data.error,/закрыта/);}
 assert.equal((await move(host.code,1,hostSetup,host.token)).status,404);
 assert.equal((await post({intent:'join',code:host.code,seatToken:guest.token})).status,404);
 assert.equal((await post({intent:'find',seatToken:guest.token})).status,404);
 assert.equal((await post({intent:'close',code:host.code},host.token)).status,404,'A lost close response is verified by a 404 poll');
});

test('a concurrent close and match cannot resurrect a deleted room',async()=>{
 hidePublicRooms();
 const host=(await post({intent:'create',visibility:'public'})).data;
 const [closed,matched]=await Promise.all([post({intent:'close',code:host.code},host.token),post({intent:'find',seatToken:secret()})]);
 assert([200,409].includes(closed.status));assert([200,404].includes(matched.status));
 if(closed.status===409){assert.equal(matched.status,200);assert.equal(closed.data.game.status,'setup');assert.equal((await post({intent:'close',code:host.code,revision:closed.data.revision},host.token)).status,200);}
 assert.equal((await get(host.code,host.token)).status,404);
 if(matched.status===200)assert.equal((await get(host.code,matched.data.token)).status,404);
});

test('visibility migration keeps previously created rooms private',async()=>{
 const legacy=new DatabaseSync(':memory:');
 try{
  for(const file of ['0000_brown_iron_lad.sql','0001_sturdy_green_goblin.sql'])legacy.exec(await readFile(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  legacy.prepare('INSERT INTO rooms (code,state,host_hash,revision,expires_at) VALUES (?,?,?,?,?)').run('ABCDEFG','{}','legacy-host',0,Date.now()+1000);
  legacy.exec(await readFile(new URL('../drizzle/0002_bent_garia.sql',import.meta.url),'utf8'));
  assert.equal(legacy.prepare('SELECT visibility FROM rooms WHERE code = ?').get('ABCDEFG').visibility,'private');
 }finally{legacy.close();}
});


test('Android app origin can use the same room seats but foreign origins and missing tokens cannot',async()=>{
 const origin='https://appassets.androidplatform.net';
 const host=await post({intent:'create'},undefined,origin);assert.equal(host.status,201);
 const read=async(origin,token)=>GET(new Request(`https://game.test/api/rooms?code=${host.data.code}`,{headers:{Origin:origin,...(token?{Authorization:`Bearer ${token}`}:{})}}));
 assert.equal((await read(origin,host.data.token)).status,200);assert.equal((await read(origin,'wrong')).status,403);
 assert.equal((await read('https://evil.test',host.data.token)).status,403);
 const confirmed=await post({intent:'action',code:host.data.code,revision:0,action:hostSetup},host.data.token,origin);assert.equal(confirmed.status,200);
 assert.equal((await post({intent:'close',code:host.data.code},'wrong',origin)).status,403);
 assert.equal((await post({intent:'close',code:host.data.code},host.data.token,origin)).status,200);
});

async function playingRoom(){
 const host=(await post({intent:'create'})).data,guest=(await post({intent:'join',code:host.code})).data;
 await move(host.code,1,hostSetup,host.token);
 const started=await move(host.code,2,guestSetup,guest.token);assert.equal(started.status,200);
 return {host,guest,room:started.data};
}
function absentFor(code,actor,milliseconds=121_000){
 const row=db.prepare('SELECT state FROM rooms WHERE code = ?').get(code),game=JSON.parse(row.state),at=Date.now()-milliseconds;
 game.startedAt=at;
 db.prepare(`UPDATE rooms SET state = ?, ${actor===0?'host_seen_at':'guest_seen_at'} = ? WHERE code = ?`).run(JSON.stringify(game),at,code);
}
const claim=(code,revision,token)=>post({intent:'claimDisconnect',code,revision},token);

test('reconnect window uses server time, is unavailable before the match, and starts no earlier than play',async()=>{
 const host=(await post({intent:'create'})).data,guest=(await post({intent:'join',code:host.code})).data;
 assert.equal(guest.reconnectGraceMs,120_000);
 absentFor(host.code,0);
 assert.equal((await claim(host.code,1,guest.token)).status,409,'Setup absence cannot award a win');
 await move(host.code,1,hostSetup,host.token);
 db.prepare('UPDATE rooms SET host_seen_at = ? WHERE code = ?').run(Date.now()-600_000,host.code);
 const started=await move(host.code,2,guestSetup,guest.token);
 assert.equal(started.status,200);assert(started.data.game.startedAt>0);
 assert.equal((await claim(host.code,3,guest.token)).status,409,'A player ready before a long lobby wait still gets the reconnect window');
 assert.equal((await claim(host.code,3,'wrong')).status,403);
 assert.equal((await post({intent:'claimDisconnect',code:host.code,revision:3,serverTime:Date.now()+9999999},guest.token)).status,409,'Client clocks cannot shorten the grace period');
 assert.equal((await move(host.code,3,{type:'claimDisconnect'},guest.token)).status,400,'The claim is server-only, not an engine action');
 const state=(await get(host.code,guest.token)).data;
 assert.equal(state.game.status,'playing');assert.equal(state.game.winner,null);
});

test('only an authenticated claimant ends a stale playing match, and the result cannot be rewritten',async()=>{
 const {host,guest}=await playingRoom();absentFor(host.code,0);
 const result=await claim(host.code,3,guest.token);assert.equal(result.status,200);
 assert.equal(result.data.game.status,'finished');assert.equal(result.data.game.winner,1);assert.equal(result.data.game.finishReason,'disconnect');assert.equal(result.data.revision,4);
 assert.equal(result.data.game.turn,0,'The guest can claim outside their own turn');
 assert.deepEqual(result.data.game.players[0].hand,[]);assert.deepEqual(result.data.game.players[0].layout,{});
 assert(!JSON.stringify(result.data).includes(host.token));
 assert.equal((await claim(host.code,3,guest.token)).status,409);
 assert.equal((await claim(host.code,4,host.token)).status,409);
 assert.equal((await move(host.code,4,{type:'surrender'},guest.token)).status,400);
 const restored=(await get(host.code,host.token)).data;
 assert.equal(restored.game.winner,1);assert.equal(restored.game.finishReason,'disconnect');assert.equal(restored.revision,4);
 assert.equal((await post({intent:'close',code:host.code,revision:4},host.token)).status,200);
});

test('no automatic loss is assigned when both players disappear',async()=>{
 const {host,guest}=await playingRoom();absentFor(host.code,0);absentFor(host.code,1);
 const returned=(await get(host.code,guest.token)).data;
 assert.equal(returned.game.status,'playing');assert.equal(returned.game.winner,null);assert.equal(returned.revision,3);
 assert.equal((await claim(host.code,3,host.token)).status,409,'The returned guest is now present');
});

test('a heartbeat that wins the database race prevents a stale disconnect claim without changing revision',async()=>{
 const {host,guest}=await playingRoom();absentFor(host.code,1);
 beforeRun=(sql)=>{if(sql.startsWith('UPDATE rooms SET state')&&sql.includes('guest_seen_at <= ?')){beforeRun=undefined;db.prepare('UPDATE rooms SET guest_seen_at = ? WHERE code = ?').run(Date.now(),host.code);}};
 let result;try{result=await claim(host.code,3,host.token);}finally{beforeRun=undefined;}
 assert.equal(result.status,409);assert.equal(result.data.game.status,'playing');assert.equal(result.data.revision,3);assert.equal(result.data.game.winner,null);
 assert(result.data.presence[1]>=Date.now()-1000);
 assert.equal((await move(host.code,3,{type:'end'},host.token)).status,200);
 assert.equal((await get(host.code,guest.token)).data.game.turn,1);
});

test('concurrent move and disconnect claim commit at most one transition',async()=>{
 const {host,guest}=await playingRoom();absentFor(host.code,0);
 const results=await Promise.all([claim(host.code,3,guest.token),move(host.code,3,{type:'end'},host.token)]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const winner=results.find(r=>r.status===200).data,stored=(await get(host.code,guest.token)).data;
 assert.equal(stored.revision,4);assert.equal(stored.game.status,winner.game.status);assert.equal(stored.game.winner,winner.game.winner);
 if(stored.game.status==='playing')assert(stored.presence[0]>Date.now()-1000,'A successful move is proof of presence');
});

test('host close is forbidden during play and cannot race a second readiness confirmation',async()=>{
 const {host}=await playingRoom();
 const denied=await post({intent:'close',code:host.code},host.token);assert.equal(denied.status,409);assert.match(denied.data.error,/Сдаться/);assert.equal(denied.data.game.status,'playing');
 const lobby=(await post({intent:'create'})).data,guest=(await post({intent:'join',code:lobby.code})).data;
 await move(lobby.code,1,hostSetup,lobby.token);
 beforeFirst=(sql)=>{if(sql.startsWith('DELETE FROM rooms')){beforeFirst=undefined;const row=db.prepare('SELECT state FROM rooms WHERE code = ?').get(lobby.code),game=JSON.parse(row.state);game.players[1].ready=true;game.status='playing';game.startedAt=Date.now();db.prepare('UPDATE rooms SET state = ?, revision = revision + 1 WHERE code = ?').run(JSON.stringify(game),lobby.code);}};
 let closed;try{closed=await post({intent:'close',code:lobby.code,revision:2},lobby.token);}finally{beforeFirst=undefined;}
 assert.equal(closed.status,409);assert.equal(closed.data.game.status,'playing');assert.equal(closed.data.revision,3);
 assert.equal((await get(lobby.code,guest.token)).status,200,'Both seats survive the failed close');
 const surrender=await move(lobby.code,3,{type:'surrender'},lobby.token);assert.equal(surrender.status,200);assert.equal(surrender.data.game.finishReason,'surrender');
 assert.equal((await post({intent:'close',code:lobby.code,revision:4},lobby.token)).status,200);
});

const pause=(code,revision,decision,token)=>post({intent:'pause',code,revision,decision},token);
const storedGame=code=>JSON.parse(db.prepare('SELECT state FROM rooms WHERE code = ?').get(code).state);
const resources=game=>({turn:game.turn,round:game.round,ap:game.ap,players:game.players.map(p=>({money:p.money,earned:p.earned,hand:p.hand,deck:p.deck,nodes:p.nodes,layout:p.layout,reserve:p.reserve}))});

test('mutual pause requires another player, pending requests do not block play, and pause preserves resources',async()=>{
 const {host,guest}=await playingRoom();
 assert.equal((await pause(host.code,3,'request','wrong')).status,403);
 assert.equal((await pause(host.code,3,'invented',host.token)).status,400);
 const requested=await pause(host.code,3,'request',host.token);assert.equal(requested.status,200);assert.deepEqual(requested.data.game.pause,{requestedBy:0,pausedAt:null});
 assert.equal((await pause(host.code,4,'request',guest.token)).status,409,'A second request is not implicit consent');
 assert.equal((await pause(host.code,4,'accept',host.token)).status,409);
 assert.equal((await pause(host.code,4,'decline',host.token)).status,409);
 assert.equal((await pause(host.code,4,'cancel',guest.token)).status,409);
 assert.equal((await pause(host.code,4,'resume',host.token)).status,409);
 const pendingMove=await move(host.code,4,{type:'end'},host.token);assert.equal(pendingMove.status,200);assert.equal(pendingMove.data.game.turn,1);
 const before=storedGame(host.code),accepted=await pause(host.code,5,'accept',guest.token);assert.equal(accepted.status,200);assert.equal(accepted.data.game.pause.requestedBy,0);assert(accepted.data.game.pause.pausedAt>0);assert.equal(accepted.data.revision,6);
 assert.deepEqual(resources(storedGame(host.code)),resources(before));
 const paused=storedGame(host.code);
 assert.equal(actionStatus(viewGame(paused,1),{type:'draw'}).ok,false);
 assert.throws(()=>applyAction(paused,1,{type:'draw'}),/паузе/,'The shared engine rejects actions even without the route');
 for(const action of [{type:'draw'},{type:'end'},{type:'exchange',card:'ddos',kind:'economy'},{type:'card',card:'recon',cell:0,side:'enemy'},{type:'reserve',counter:'auth'}])assert.equal((await move(host.code,6,action,guest.token)).status,400);
 assert.deepEqual(resources(storedGame(host.code)),resources(before));
 const other=(await get(host.code,host.token)).data;assert.deepEqual(other.game.pause,accepted.data.game.pause);assert.deepEqual(other.game.players[1].hand,[]);assert.deepEqual(other.game.players[1].layout,{});
 assert.equal((await post({intent:'close',code:host.code,revision:6},host.token)).status,409,'Pause cannot erase an active match');
});

test('agreed pause blocks technical losses and either participant can resume with a fresh grace period',async()=>{
 const {host,guest}=await playingRoom();
 await pause(host.code,3,'request',guest.token);await pause(host.code,4,'accept',host.token);
 absentFor(host.code,0);absentFor(host.code,1);
 const denied=await claim(host.code,5,host.token);assert.equal(denied.status,409);assert.match(denied.data.error,/паузе/);assert.equal(denied.data.game.winner,null);
 const before=storedGame(host.code),resumed=await pause(host.code,5,'resume',host.token);assert.equal(resumed.status,200);assert.equal(resumed.data.game.pause,undefined);assert(resumed.data.game.resumedAt>0);assert.deepEqual(resources(storedGame(host.code)),resources(before));
 assert.equal((await claim(host.code,6,host.token)).status,409,'The absent guest gets a fresh 120 seconds from resume');
 assert.equal((await pause(host.code,6,'resume',guest.token)).status,409,'Duplicate resume cannot keep extending the grace period');
 const restored=(await get(host.code,guest.token)).data;assert.equal(restored.game.resumedAt,resumed.data.game.resumedAt);assert.equal(restored.game.pause,undefined);
 await pause(host.code,6,'request',host.token);await pause(host.code,7,'accept',guest.token);
 const resumedByRequester=await pause(host.code,8,'resume',host.token);assert.equal(resumedByRequester.status,200);assert.equal(resumedByRequester.data.game.pause,undefined);
 await pause(host.code,9,'request',host.token);await pause(host.code,10,'accept',guest.token);
 const resumedByAccepter=await pause(host.code,11,'resume',guest.token);assert.equal(resumedByAccepter.status,200);assert.equal(resumedByAccepter.data.game.pause,undefined);
});

test('decline and cancel only clear pending requests; surrender clears an agreed pause',async()=>{
 const {host,guest}=await playingRoom();
 await pause(host.code,3,'request',host.token);
 const declined=await pause(host.code,4,'decline',guest.token);assert.equal(declined.status,200);assert.equal(declined.data.game.pause,undefined);
 await pause(host.code,5,'request',guest.token);
 const cancelled=await pause(host.code,6,'cancel',guest.token);assert.equal(cancelled.status,200);assert.equal(cancelled.data.game.pause,undefined);
 assert.equal((await pause(host.code,7,'accept',host.token)).status,409);
 await pause(host.code,7,'request',host.token);await pause(host.code,8,'accept',guest.token);
 assert.equal((await pause(host.code,9,'decline',guest.token)).status,409);assert.equal((await pause(host.code,9,'cancel',host.token)).status,409);
 const ended=await move(host.code,9,{type:'surrender'},guest.token);assert.equal(ended.status,200);assert.equal(ended.data.game.winner,0);assert.equal(ended.data.game.finishReason,'surrender');assert.equal(ended.data.game.pause,undefined);
 assert.equal((await pause(host.code,10,'resume',host.token)).status,409);assert.equal((await pause(host.code,10,'request',host.token)).status,409);
 await move(host.code,10,{type:'rematch'},host.token);const rematch=await move(host.code,11,{type:'rematch'},guest.token);assert.equal(rematch.status,200);assert.equal(rematch.data.game.pause,undefined);assert.equal(rematch.data.game.resumedAt,undefined);
 assert.equal((await pause(host.code,12,'request',host.token)).status,409,'A new setup is not playing');
});

test('simultaneous pause requests and accept/cancel race commit only one state transition',async()=>{
 const {host,guest}=await playingRoom();
 const requested=await Promise.all([pause(host.code,3,'request',host.token),pause(host.code,3,'request',guest.token)]);assert.deepEqual(requested.map(r=>r.status).sort(),[200,409]);
 const seat=requested.find(r=>r.status===200).data.game.pause.requestedBy,requester=seat===0?host:guest,other=seat===0?guest:host;
 const decisions=await Promise.all([pause(host.code,4,'accept',other.token),pause(host.code,4,'cancel',requester.token)]);assert.deepEqual(decisions.map(r=>r.status).sort(),[200,409]);
 const result=decisions.find(r=>r.status===200).data,current=(await get(host.code,host.token)).data;assert.equal(current.revision,5);assert.deepEqual(current.game.pause,result.game.pause);assert.equal(current.game.ap,3);assert.equal(current.game.turn,0);
});

test('accepting a pause races safely with an already submitted gameplay action',async()=>{
 const {host,guest}=await playingRoom();await pause(host.code,3,'request',guest.token);
 const results=await Promise.all([pause(host.code,4,'accept',host.token),move(host.code,4,{type:'end'},host.token)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const current=(await get(host.code,host.token)).data;assert.equal(current.revision,5);
 if(current.game.pause?.pausedAt!=null){assert.equal(current.game.turn,0);assert.equal((await move(host.code,5,{type:'end'},host.token)).status,400);}else {assert.equal(current.game.turn,1);assert.equal(current.game.pause.pausedAt,null);}
});
