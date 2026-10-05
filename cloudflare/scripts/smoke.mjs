import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {MAX_ROUNDS,MONEY_GOAL} from '../../lib/game/engine.ts';

const root=fileURLToPath(new URL('../../',import.meta.url));
const wrangler=fileURLToPath(new URL('../../node_modules/wrangler/bin/wrangler.js',import.meta.url));
const state=await mkdtemp(join(tmpdir(),'perimeter-cf-test-'));
const common=['--config','cloudflare/wrangler.json','--local','--persist-to',state];
const migration=spawnSync(process.execPath,[wrangler,'d1','migrations','apply','perimeter-rooms',...common],{cwd:root,encoding:'utf8',timeout:60000});
if(migration.status!==0){console.error(migration.stdout,migration.stderr);await rm(state,{recursive:true,force:true});process.exit(1);}
const port=await new Promise((resolve,reject)=>{const s=createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});
const metricsKey='local-smoke-'+crypto.randomUUID();
const server=spawn(process.execPath,[wrangler,'dev',...common,'--ip','127.0.0.1','--port',String(port),'--inspector-port','0','--test-scheduled','--var',`METRICS_EXPORT_TOKEN:${metricsKey}`],{cwd:root,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let logs='';for(const stream of [server.stdout,server.stderr])stream.on('data',b=>{logs=(logs+b.toString()).slice(-20000);});
const base=`http://127.0.0.1:${port}`;
const appOrigin='https://appassets.androidplatform.net';
const headers=token=>({'Content-Type':'application/json',Origin:base,...(token?{Authorization:`Bearer ${token}`}:{})});
const post=async(body,token,origin=base)=>{const response=await fetch(base+'/api/rooms',{method:'POST',headers:{...headers(token),Origin:origin},body:JSON.stringify(body)});return {status:response.status,data:await response.json(),headers:response.headers};};
const get=async(code,token)=>{const response=await fetch(base+'/api/rooms?code='+code,{headers:{Authorization:`Bearer ${token}`}});return {status:response.status,data:await response.json(),headers:response.headers};};
const move=(code,revision,action,token)=>post({intent:'action',code,revision,action},token);
const secret=()=>crypto.randomUUID()+crypto.randomUUID();
try{
 let ready=false;
 for(let i=0;i<100;i++){
  if(server.exitCode!==null)throw Error('Wrangler exited: '+logs);
  try{const r=await fetch(base+'/api/health');if(r.ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,300));
 }
 assert(ready,'Worker failed to start: '+logs);
 const homepage=await fetch(base+'/');assert.equal(homepage.status,200);const html=await homepage.text();assert(html.includes('КОНТУР'));
 assert(homepage.headers.get('content-security-policy')?.includes("connect-src 'self'"));
 for(const path of [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m=>m[1]))assert.equal((await fetch(base+path)).status,200);
 const absent=await fetch(base+'/api/not-found');assert.equal(absent.status,404);assert(absent.headers.get('content-type').includes('json'));
 const preflight=await fetch(base+'/api/rooms',{method:'OPTIONS',headers:{Origin:appOrigin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization, content-type'}});
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),appOrigin);assert.equal(preflight.headers.get('access-control-allow-credentials'),null);assert(preflight.headers.get('vary')?.includes('Origin'));
 const deniedPreflight=await fetch(base+'/api/rooms',{method:'OPTIONS',headers:{Origin:'https://foreign.example','Access-Control-Request-Method':'POST'}});assert.equal(deniedPreflight.status,403);assert.equal(deniedPreflight.headers.get('access-control-allow-origin'),null);
 const seat=secret();const created=await post({intent:'create',name:'Альфа',seatToken:seat},undefined,appOrigin);assert.equal(created.status,201);assert.equal(created.headers.get('access-control-allow-origin'),appOrigin);const host=created.data;
 const replay=await post({intent:'create',name:'Альфа',seatToken:seat});assert.equal(replay.status,200);assert.equal(replay.data.code,host.code);
 assert.equal(host.visibility,'private');
 assert.equal((await post({intent:'find',seatToken:secret()})).status,404,'Private invitation rooms cannot be found');
 const guestSeat=secret();
 const joined=await post({intent:'join',code:host.code,name:'Бета',seatToken:guestSeat});assert.equal(joined.status,200);const guest=joined.data;
 assert(joined.data.presence.every(time=>time>0),'Both players are present immediately after joining');
 const resumedJoin=await post({intent:'join',code:host.code,seatToken:guestSeat});assert.equal(resumedJoin.status,200);assert.equal(resumedJoin.data.game.viewer,1);assert.equal(resumedJoin.data.revision,1);
 assert.equal((await get(host.code,'invalid')).status,403);
 const invalidAppSeat=await fetch(base+'/api/rooms?code='+host.code,{headers:{Origin:appOrigin,Authorization:'Bearer invalid'}});assert.equal(invalidAppSeat.status,403);assert.equal(invalidAppSeat.headers.get('access-control-allow-origin'),appOrigin);
 const appPoll=await fetch(base+'/api/rooms?code='+host.code,{headers:{Origin:appOrigin,Authorization:`Bearer ${host.token}`}});assert.equal(appPoll.status,200);assert.equal(appPoll.headers.get('access-control-allow-origin'),appOrigin);
 assert.equal((await post({intent:'create'},null,'https://foreign.example')).status,403);
 const hostSetup={type:'deploy',deployment:{layout:[0,4,20,24,12],shields:[0,0,0,0,0],sensors:[0,0,0,0,0]}};
 const guestSetup={type:'deploy',deployment:{layout:[12,6,18,22,10],shields:[0,0,0,0,0],sensors:[0,0,0,0,0]}};
 assert.equal((await move(host.code,1,{...hostSetup,deployment:{...hostSetup.deployment,layout:[0,0,20,24,12]}},host.token)).status,400);
 assert.equal(joined.data.game.status,'setup');assert.equal(joined.data.reconnectGraceMs,120_000);
 assert.equal((await post({intent:'claimDisconnect',code:host.code,revision:1},guest.token)).status,409,'Readiness is not a match and cannot yield technical victory');
 let result=await move(host.code,1,hostSetup,host.token);assert.equal(result.status,200);assert.equal(result.data.game.status,'setup');assert.equal(result.data.game.players[0].ready,true);assert.equal(result.data.game.players[1].ready,false);
 result=await move(host.code,2,guestSetup,guest.token);assert.equal(result.status,200);assert.equal(result.data.game.status,'playing');assert(result.data.game.startedAt>0);assert(result.data.game.startedAt<=result.data.serverTime);
 const activeClose=await post({intent:'close',code:host.code,revision:3},host.token);assert.equal(activeClose.status,409);assert.equal(activeClose.data.game.status,'playing');assert.equal(activeClose.data.revision,3);
 const liveClaim=await post({intent:'claimDisconnect',code:host.code,revision:3},host.token);assert.equal(liveClaim.status,409);assert.equal(liveClaim.data.game.winner,null);assert.equal(liveClaim.data.reconnectGraceMs,120_000);
 assert.equal((await move(host.code,3,{type:'end'},guest.token)).status,400,'Opponent cannot play out of turn');
 const masked=(await get(host.code,guest.token)).data;assert.deepEqual(masked.game.players[0].hand,[]);assert.deepEqual(masked.game.players[0].layout,{});assert(!JSON.stringify(masked).includes(host.token));
 result=await move(host.code,3,{type:'card',card:'recon',cell:12,side:'enemy'},host.token);assert.equal(result.status,200);
 const duplicate=await Promise.all([move(host.code,4,{type:'card',card:'ddos',node:'web',side:'enemy'},host.token),move(host.code,4,{type:'card',card:'ddos',node:'web',side:'enemy'},host.token)]);
 assert.deepEqual(duplicate.map(r=>r.status).sort(),[200,409]);
 const recovered=await get(host.code,host.token);assert.equal(recovered.data.revision,5);assert.equal(recovered.data.game.players[0].money,240);assert.equal(recovered.headers.get('cache-control'),'no-store');
 assert.equal((await get(host.code,guest.token)).data.game.players[1].nodes.web.offline,true);
 result=await move(host.code,5,{type:'end'},host.token);assert.equal(result.status,200);
 result=await move(host.code,6,{type:'reserve',counter:'auth'},guest.token);assert.equal(result.status,200);
 assert.equal(result.data.game.players[1].reserve,'auth');
 const hiddenReserve=(await get(host.code,host.token)).data;assert.equal(hiddenReserve.game.players[1].reserve,'hidden');assert(!hiddenReserve.game.logs.some(log=>log.text.startsWith('Дежурство:')));
 result=await move(host.code,7,{type:'end'},guest.token);assert.equal(result.status,200);
 result=await move(host.code,8,{type:'end'},host.token);assert.equal(result.status,200);
 assert.equal((await get(host.code,guest.token)).data.game.players[1].reserve,'auth','An unused reserve survives until needed');
 assert.equal((await move(host.code,7,{type:'end'},guest.token)).status,409,'A reconnected client cannot replay an old turn');
 result=await move(host.code,9,{type:'surrender'},guest.token);assert.equal(result.status,200);assert.equal(result.data.game.winner,0);assert.equal(result.data.game.finishReason,'surrender');
 result=await move(host.code,10,{type:'rematch'},host.token);assert.equal(result.status,200);assert.equal(result.data.game.status,'finished');
 assert.equal((await move(host.code,11,{type:'rematch'},host.token)).status,400,'One player cannot vote for both sides');
 result=await move(host.code,11,{type:'rematch'},guest.token);assert.equal(result.status,200);assert.equal(result.data.game.status,'setup');assert.equal(result.data.game.firstPlayer,1);assert.equal(result.data.game.startedAt,undefined);assert.equal(result.data.game.finishReason,undefined);
 result=await move(host.code,12,hostSetup,host.token);assert.equal(result.status,200);
 result=await move(host.code,13,guestSetup,guest.token);assert.equal(result.status,200);assert.equal(result.data.game.turn,1);
 let room=result.data,turns=0;
 while(room.game.status==='playing'){
  assert(turns++<MAX_ROUNDS*2,'A match must finish within the round limit');
  const seat=room.game.turn===0?host:guest;
  const fresh=await get(host.code,seat.token);assert.equal(fresh.status,200);assert.equal(fresh.data.revision,room.revision);
  result=await move(host.code,fresh.data.revision,{type:'end'},seat.token);assert.equal(result.status,200);room=result.data;
 }
 assert.equal(room.game.winner,null,'Equal economies finish with a draw');assert.equal(room.game.finishReason,'score');
 assert(room.game.players.every(player=>player.money>=MONEY_GOAL),'A full round pays both companies before the finish');
 assert.equal((await get(host.code,host.token)).data.game.status,'finished');assert.equal((await get(host.code,guest.token)).data.game.status,'finished');
 assert.equal((await move(host.code,room.revision,{type:'end'},host.token)).status,400,'A finished match rejects further turns');
 const openHost=(await post({intent:'create',visibility:'public',name:'Open host',seatToken:secret()})).data;
 assert.equal(openHost.visibility,'public');
 const findSeat=secret(),found=await post({intent:'find',name:'Matched guest',seatToken:findSeat});
 assert.equal(found.status,200);assert.equal(found.data.code,openHost.code);assert.equal(found.data.game.viewer,1);
 assert.deepEqual(found.data.game.players[0].layout,{});assert.deepEqual(found.data.game.players[0].hand,[]);
 const recoveredFind=await post({intent:'find',seatToken:findSeat});assert.equal(recoveredFind.status,200);assert.equal(recoveredFind.data.code,openHost.code);assert.equal(recoveredFind.data.revision,1);
 assert.equal((await post({intent:'close',code:openHost.code},findSeat)).status,403,'The guest cannot close the room');
 assert.equal((await move(openHost.code,1,hostSetup,openHost.token)).status,200);
 const openStarted=await move(openHost.code,2,guestSetup,findSeat);assert.equal(openStarted.status,200);assert.equal(openStarted.data.game.status,'playing');
 assert.equal((await post({intent:'close',code:openHost.code,revision:3},openHost.token)).status,409,'A host cannot erase an ongoing game');
 const pauseRequest=await post({intent:'pause',code:openHost.code,revision:3,decision:'request'},openHost.token);assert.equal(pauseRequest.status,200);assert.deepEqual(pauseRequest.data.game.pause,{requestedBy:0,pausedAt:null});
 assert.equal((await post({intent:'pause',code:openHost.code,revision:4,decision:'accept'},openHost.token)).status,409,'A player cannot approve their own pause');
 const pauseAccepted=await post({intent:'pause',code:openHost.code,revision:4,decision:'accept'},findSeat);assert.equal(pauseAccepted.status,200);assert(pauseAccepted.data.game.pause.pausedAt>0);
 assert.equal((await move(openHost.code,5,{type:'draw'},openHost.token)).status,400,'An agreed pause prevents resource-changing actions');
 assert.equal((await post({intent:'claimDisconnect',code:openHost.code,revision:5},openHost.token)).status,409,'An agreed pause prevents technical loss');
 const pauseResumed=await post({intent:'pause',code:openHost.code,revision:5,decision:'resume'},openHost.token);assert.equal(pauseResumed.status,200);assert.equal(pauseResumed.data.game.pause,undefined);assert(pauseResumed.data.game.resumedAt>0);assert.equal(pauseResumed.data.game.ap,3);assert.equal(pauseResumed.data.game.turn,0);assert.deepEqual(pauseResumed.data.game.players.map(p=>p.money),[300,300]);
 const openSurrender=await move(openHost.code,6,{type:'surrender'},findSeat);assert.equal(openSurrender.status,200);assert.equal(openSurrender.data.game.status,'finished');assert.equal(openSurrender.data.game.winner,0);assert.equal(openSurrender.data.game.finishReason,'surrender');
 const closed=await post({intent:'close',code:openHost.code,revision:7},openHost.token);assert.equal(closed.status,200);assert.equal(closed.data.closed,true);
 const cancelled=(await post({intent:'create',seatToken:secret()})).data;
 assert.equal((await post({intent:'close',code:cancelled.code,revision:0},cancelled.token)).status,200,'A waiting room can be closed without assigning a winner');
 assert.equal((await get(openHost.code,openHost.token)).status,404);assert.equal((await get(openHost.code,findSeat)).status,404);
 assert.equal((await post({intent:'find',seatToken:findSeat})).status,404,'Closed rooms are not searchable or recoverable');
 const exportMetrics=async key=>{const response=await fetch(base+'/api/metrics/export',{headers:{Authorization:`Bearer ${key}`}});return {status:response.status,data:await response.json()};};
 assert.equal((await exportMetrics('wrong')).status,401,'Metrics export requires the owner secret');
 const diagnostics=await fetch(base+'/api/metrics',{method:'POST',headers:{...headers(host.token),Origin:appOrigin},body:JSON.stringify({code:host.code,events:[{type:'card_drag',card:'ddos',outcome:'cancelled',durationMs:450}]})});assert.equal(diagnostics.status,202);assert.equal(diagnostics.headers.get('access-control-allow-origin'),appOrigin);
 const deniedAppExport=await fetch(base+'/api/metrics/export',{headers:{Origin:appOrigin,Authorization:`Bearer ${metricsKey}`}});assert.equal(deniedAppExport.status,403);assert.equal(deniedAppExport.headers.get('access-control-allow-origin'),null);
 const metricsReport=await exportMetrics(metricsKey);assert.equal(metricsReport.status,200);assert.equal(metricsReport.data.truncated,false);
 assert(metricsReport.data.matches.some(match=>match.status==='finished'));assert(metricsReport.data.matches.some(match=>match.status==='abandoned'&&match.finishReason==='closed'));
 const closedFinished=metricsReport.data.events.filter(event=>event.type==='closed').map(event=>metricsReport.data.matches.find(match=>match.id===event.matchId));assert(closedFinished.some(match=>match?.status==='finished'&&match.finishReason==='surrender'&&match.winner===0),'Closing a finished room preserves its surrender result');
 assert.equal(metricsReport.data.events.filter(event=>event.type==='pause').length,3);
 assert(metricsReport.data.events.some(event=>event.source==='client'&&event.type==='card_drag'));assert(metricsReport.data.events.some(event=>event.source==='server'&&event.action==='card'&&event.card==='ddos'&&event.moneySpent===40));
 for(const value of [host.code,openHost.code,host.token,guest.token,'Альфа','Бета','host_hash','guest_hash','layout','hand'])assert(!JSON.stringify(metricsReport.data).includes(value),'Metrics must not export '+value);
 let rateLimited=false;
 for(let i=0;i<15;i++){const r=await post({intent:'create',seatToken:secret()},'spoofed-authorization');if(r.status===429){rateLimited=true;assert.equal(r.headers.get('retry-after'),'60');break;}assert.equal(r.status,201);}
 assert(rateLimited,'Admission rate limiter did not engage');
 const cleanup=await fetch(base+'/__scheduled?cron=17+*+*+*+*');assert(cleanup.ok,'Scheduled cleanup failed');
 console.log('PASS: Worker + real local D1; two independent HTTP clients; assets/CSP; exact Android CORS/preflight/errors; idempotent create/join/find; private room isolation; open-room matching; host-only pregame/final closure; active-close rejection; both-ready start; reconnect grace and live-claim rejection; persistent terminal reasons; mutual pause and fresh resume grace; authenticated central metrics; private-data-free owner export; immediate presence; invalid setup/out-of-turn/replayed/finished actions; private hand/layout/reserve; concurrent attack/CAS; reconnect; persistent reserve; surrender; two-vote rematch with switched first player; complete financial finish; origin check; admission limiter; scheduled handler.');
}catch(error){console.error(logs);throw error;}
finally{
 if(server.exitCode===null){try{if(process.platform==='win32')server.kill('SIGTERM');else process.kill(-server.pid,'SIGTERM');}catch{}}
 await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);setTimeout(resolve,2000).unref();});
 await rm(state,{recursive:true,force:true});
}
