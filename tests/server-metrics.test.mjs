import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import ts from 'typescript';
const db=new DatabaseSync(':memory:');
for(const file of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())db.exec(await readFile(new URL('../drizzle/'+file,import.meta.url),'utf8'));
let failMetrics=false;
let beforeDelete;
let maxBindings=0;
const adapter={prepare(sql){if(failMetrics&&sql.includes('metrics_'))throw Error('Simulated metrics outage');let args=[];return {bind(...v){assert(v.length<=100,'D1 supports at most 100 bound parameters per query');maxBindings=Math.max(maxBindings,v.length);args=v;return this;},async first(){if(sql.startsWith('DELETE FROM rooms')&&beforeDelete){const hook=beforeDelete;beforeDelete=undefined;hook();}return db.prepare(sql).get(...args)??null;},async all(){return {results:db.prepare(sql).all(...args)};},run(){const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}};},async batch(statements){db.exec('BEGIN');try{const out=statements.map(s=>s.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}};
globalThis.__contourMetricsTestDb=adapter;
const compile=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const transform=source=>source.replace("import { roomDb } from '@/db/rooms';",'const roomDb=()=>globalThis.__contourMetricsTestDb;').replace("'@/lib/game/engine'",JSON.stringify(new URL('../lib/game/engine.ts',import.meta.url).href));
const libUrl=compile(transform(await readFile(new URL('../lib/server/metrics.ts',import.meta.url),'utf8')));
const {cleanupMetrics}=await import(libUrl);
const routes=await import(compile(transform(await readFile(new URL('../app/api/rooms/route.ts',import.meta.url),'utf8')).replace("'@/lib/server/metrics'",JSON.stringify(libUrl))));
const metrics=await import(compile(transform(await readFile(new URL('../app/api/metrics/route.ts',import.meta.url),'utf8')).replace("import { env } from 'cloudflare:workers';",'const env={};').replace("'@/lib/server/metrics'",JSON.stringify(libUrl))));
const secret=()=>crypto.randomUUID()+crypto.randomUUID();
const request=(path,body,token,origin='https://game.test')=>new Request('https://game.test'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
const post=async(body,token)=>{const r=await routes.POST(request('/api/rooms',body,token));return {status:r.status,data:await r.json()};};
const ingest=async(body,token,origin)=>{const r=await metrics.POST(request('/api/metrics',body,token,origin));return {status:r.status,data:await r.json()};};
const ownerKey='local-unit-test-export-key';
const report=async(token=ownerKey,key=ownerKey,query='')=>{const r=await metrics.handleMetricsExport(new Request('https://game.test/api/metrics/export'+query,{headers:{Authorization:`Bearer ${token}`}}),key);return {status:r.status,data:await r.json()};};
const hostSetup={type:'deploy',deployment:{layout:[0,4,20,24,12],shields:[0,0,0,0,0],sensors:[0,0,0,0,0]}};
const guestSetup={type:'deploy',deployment:{layout:[12,6,18,22,10],shields:[0,0,0,0,0],sensors:[0,0,0,0,0]}};
const move=(room,revision,action,token)=>post({intent:'action',code:room.code,revision,action},token??room.token);
let tracked;
test('central collection works without an export key; owner export is protected',async()=>{
 tracked=(await post({intent:'create',name:'SECRET HOST NAME'})).data;
 assert.equal(db.prepare('SELECT count(*) n FROM metrics_matches').get().n,1);
 assert.equal((await report('wrong')).status,401);assert.equal((await report(ownerKey,'')).status,503);
 assert.equal((await report(ownerKey,ownerKey,'?since=invalid')).status,400);
 assert.equal((await report(ownerKey,ownerKey,'?since=2020-01-01&until=2030-01-01')).status,400);
 assert.equal((await report()).status,200);
});
test('client diagnostics authenticate the seat and only accept a small closed event schema',async()=>{
 const event={type:'card_drag',card:'ddos',outcome:'cancelled',durationMs:350};
 for(const key of [undefined,'wrong',secret()])assert.equal((await ingest({code:tracked.code,events:[event]},key)).status,403);
 assert.equal((await ingest({code:tracked.code,events:[event]},tracked.token,'https://evil.test')).status,403);
 for(const events of [[],Array(11).fill(event),[{...event,name:'private text'}],[{...event,card:'constructor'}],[{...event,outcome:'raw error'}],[{...event,durationMs:-1}],[{...event,durationMs:60001}],[{...event,durationMs:0.1}],[{...event,type:'action'}]])assert.equal((await ingest({code:tracked.code,events},tracked.token)).status,400);
 assert.equal((await ingest({code:tracked.code,events:[{...event,detail:'x'.repeat(4200)}]},tracked.token)).status,413);
 const accepted=await ingest({code:tracked.code,events:[event]},tracked.token);assert.equal(accepted.status,202);assert.equal(accepted.data.accepted,1);
 const row=db.prepare("SELECT * FROM metrics_events WHERE type = 'card_drag'").get();assert.equal(row.source,'client');assert.deepEqual(JSON.parse(row.data),{card:'ddos',outcome:'cancelled',durationMs:350});
});
test('authoritative card action is recorded once after CAS, errors separately, snapshots omit private data',async()=>{
 const guest=(await post({intent:'join',code:tracked.code,name:'SECRET GUEST NAME'})).data;
 await move(tracked,1,hostSetup);await move(tracked,2,guestSetup,guest.token);
 const attempts=await Promise.all([move(tracked,3,{type:'card',card:'recon',cell:12,side:'enemy'}),move(tracked,3,{type:'card',card:'recon',cell:12,side:'enemy'})]);
 assert.deepEqual(attempts.map(x=>x.status).sort(),[200,409]);
 const exported=(await report()).data;
 assert.equal(exported.matches.length,1);const match=exported.matches[0];assert.equal(match.status,'playing');assert.equal(match.startedAt!==null,true);assert.equal(match.money[0],280);
 const recon=exported.events.filter(e=>e.type==='action'&&e.card==='recon');assert.equal(recon.length,1);assert.equal(recon[0].source,'server');assert.equal(recon[0].moneySpent,20);assert.equal(recon[0].apSpent,1);
 assert(exported.events.some(e=>e.type==='request_error'));assert.equal(exported.truncated,false);
 const serialized=JSON.stringify(exported);
 for(const value of [tracked.code,tracked.token,guest.token,'SECRET HOST NAME','SECRET GUEST NAME','host_hash','guest_hash','layout','hand','deck'])assert(!serialized.includes(value),value);
 tracked.guestToken=guest.token;
});
test('metrics write failures cannot reject or duplicate a saved game action',async()=>{
 failMetrics=true;let response;
 try{response=await move(tracked,4,{type:'card',card:'ddos',node:'web',side:'enemy'});}finally{failMetrics=false;}
 assert.equal(response.status,200);assert.equal(response.data.revision,5);assert.equal(response.data.game.players[0].money,240);
 assert.equal((await move(tracked,4,{type:'card',card:'ddos',node:'web',side:'enemy'})).status,409);
 assert.equal(JSON.parse(db.prepare('SELECT state FROM rooms WHERE code = ?').get(tracked.code).state).players[0].money,240);
 assert.equal(db.prepare("SELECT count(*) n FROM metrics_events WHERE type='action' AND json_extract(data,'$.card')='ddos'").get().n,0,'Best-effort telemetry can be incomplete without replaying gameplay');
});
test('finished results, rematches and abandoned closure persist independently of room deletion',async()=>{
 await move(tracked,5,{type:'surrender'},tracked.guestToken);
 let data=(await report()).data;const original=data.matches[0];assert.equal(original.status,'finished');assert.equal(original.finishReason,'surrender');assert.equal(original.winner,0);assert(original.endedAt);assert(original.durationMs>=0);
 await move(tracked,6,{type:'rematch'});await move(tracked,7,{type:'rematch'},tracked.guestToken);
 data=(await report()).data;assert.equal(data.matches.length,2);assert(data.matches.some(m=>m.matchNumber===2&&m.firstPlayer===1));
 assert.equal((await post({intent:'close',code:tracked.code},tracked.token)).status,200);
 data=(await report()).data;assert.equal(data.matches.find(m=>m.matchNumber===1).status,'finished');assert.equal(data.matches.find(m=>m.matchNumber===2).status,'abandoned');assert.equal(data.matches.find(m=>m.matchNumber===2).finishReason,'closed');
 assert.equal((await ingest({code:tracked.code,events:[{type:'card_drag',card:'ddos',outcome:'submitted'}]},tracked.token)).status,404);
});
test('close records the exact deleted state when a move commits after the authorization read',async()=>{
 const host=(await post({intent:'create'})).data;
 // Deterministically place an already-authorized move between close's read and delete.
 beforeDelete=()=>{
  const row=db.prepare('SELECT state,revision FROM rooms WHERE code = ?').get(host.code),game=JSON.parse(row.state);
  game.players[0].money=123;game.players[1].money=456;game.round=4;
  db.prepare('UPDATE rooms SET state = ?, revision = ? WHERE code = ?').run(JSON.stringify(game),row.revision+1,host.code);
 };
 try{assert.equal((await post({intent:'close',code:host.code},host.token)).status,200);}finally{beforeDelete=undefined;}
 const reportData=(await report()).data,closed=reportData.matches.find(m=>m.status==='abandoned'&&m.money[0]===123);
 assert(closed,'The closure snapshot must come from DELETE RETURNING, not the stale authorization row');assert.deepEqual(closed.money,[123,456]);assert.equal(closed.round,4);
 const closeEvent=reportData.events.find(e=>e.matchId===closed.id&&e.type==='closed');assert.equal(closeEvent.revision,1);
 assert.equal(db.prepare('SELECT code FROM rooms WHERE code = ?').get(host.code),undefined);
});
test('fraud records its full card cost independently of stolen proceeds, reserves record their price',async()=>{
 const host=(await post({intent:'create'})).data,guest=(await post({intent:'join',code:host.code})).data;
 await move(host,1,hostSetup);await move(host,2,guestSetup,guest.token);
 const state=JSON.parse(db.prepare('SELECT state FROM rooms WHERE code = ?').get(host.code).state);
 state.players[0].hand=['fraud'];state.players[0].scanned.push(6);state.players[0].intel.push('workstation');state.players[1].nodes.workstation.access=1;state.players[1].nodes.workstation.auth=0;
 db.prepare('UPDATE rooms SET state = ? WHERE code = ?').run(JSON.stringify(state),host.code);
 const stolen=await move(host,3,{type:'card',card:'fraud',node:'workstation',side:'enemy'});assert.equal(stolen.status,200);assert.equal(stolen.data.game.players[0].money,345);
 const fraud=(await report()).data.events.find(e=>e.type==='action'&&e.card==='fraud');assert.equal(fraud.moneySpent,35);assert.equal(fraud.moneyDelta,45);assert.equal(fraud.apSpent,1);
 assert.equal((await move(host,4,{type:'reserve',counter:'auth'})).status,200);
 const reserve=(await report()).data.events.find(e=>e.type==='action'&&e.action==='reserve');assert.equal(reserve.moneySpent,30);assert.equal(reserve.moneyDelta,-30);assert.equal(reserve.apSpent,1);
});
test('retention deletes old data and marks forgotten unfinished matches as abandoned',async()=>{
 const stale=Date.now()-31*86_400_000;
 db.prepare('UPDATE metrics_events SET at = ?').run(stale);
 db.prepare('UPDATE metrics_matches SET updated_at = ?').run(stale);
 const room=(await post({intent:'create'})).data;
 db.prepare("UPDATE metrics_matches SET updated_at = ? WHERE status = 'waiting'").run(Date.now()-25*60*60*1000);
 await cleanupMetrics(adapter);
 assert.equal(db.prepare('SELECT count(*) n FROM metrics_events WHERE at < ?').get(Date.now()-30*86_400_000).n,0);
 const rows=db.prepare('SELECT * FROM metrics_matches').all();assert.equal(rows.length,1);assert.equal(rows[0].status,'abandoned');assert.equal(rows[0].finish_reason,'expired');
 await post({intent:'close',code:room.code},room.token);
});
test('100-match exports respect D1 parameter limits, bound event totals and identify truncation',async()=>{
 const sample=db.prepare('SELECT id FROM metrics_matches LIMIT 1').get().id,now=Date.now();
 for(let i=0;i<101;i++)db.prepare("INSERT INTO metrics_matches SELECT ?,match_number,visibility,revision,status,round,first_player,winner,money0,money1,income0,income1,?, ?,started_at,ended_at,finish_reason FROM metrics_matches WHERE id = ?").run('bound-'+i,now,now,sample);
 maxBindings=0;
 let exported=(await report()).data;assert.equal(exported.matches.length,100);assert(maxBindings<=4,'100 IDs are passed as one JSON binding');assert.equal(exported.truncated,true);
 const selected=exported.matches[0].id;
 for(let i=0;i<5001;i++)db.prepare("INSERT INTO metrics_events (id,match_id,at,source,type,actor,revision,round,data) VALUES (?,?,?,'client','card_drag',0,0,1,'{}')").run('event-bound-'+i,selected,now);
 exported=(await report()).data;assert.equal(exported.events.length,5000);assert.equal(exported.truncated,true);
});
