import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';

const root=fileURLToPath(new URL('../../',import.meta.url));
const wrangler=fileURLToPath(new URL('../../node_modules/wrangler/bin/wrangler.js',import.meta.url));
const state=await mkdtemp(join(tmpdir(),'perimeter-cf-test-'));
const common=['--config','cloudflare/wrangler.json','--local','--persist-to',state];
const migration=spawnSync(process.execPath,[wrangler,'d1','migrations','apply','perimeter-rooms',...common],{cwd:root,encoding:'utf8',timeout:60000});
if(migration.status!==0){console.error(migration.stdout,migration.stderr);await rm(state,{recursive:true,force:true});process.exit(1);}
const port=await new Promise((resolve,reject)=>{const s=createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});
const server=spawn(process.execPath,[wrangler,'dev',...common,'--ip','127.0.0.1','--port',String(port),'--inspector-port','0','--test-scheduled'],{cwd:root,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let logs='';for(const stream of [server.stdout,server.stderr])stream.on('data',b=>{logs=(logs+b.toString()).slice(-20000);});
const base=`http://127.0.0.1:${port}`;
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
 const seat=secret();const created=await post({intent:'create',name:'Альфа',seatToken:seat});assert.equal(created.status,201);const host=created.data;
 const replay=await post({intent:'create',name:'Альфа',seatToken:seat});assert.equal(replay.status,200);assert.equal(replay.data.code,host.code);
 const joined=await post({intent:'join',code:host.code,name:'Бета',seatToken:secret()});assert.equal(joined.status,200);const guest=joined.data;
 assert.equal((await get(host.code,'invalid')).status,403);
 assert.equal((await post({intent:'create'},null,'https://foreign.example')).status,403);
 let result=await move(host.code,1,{type:'deploy',deployment:{layout:[0,4,20,24,12],shields:[0,0,0,0,0],sensors:[0,0,0,0,0]}},host.token);assert.equal(result.status,200);
 result=await move(host.code,2,{type:'deploy',deployment:{layout:[12,6,18,22,10],shields:[0,0,0,0,0],sensors:[0,0,0,0,0]}},guest.token);assert.equal(result.status,200);assert.equal(result.data.game.status,'playing');
 const masked=(await get(host.code,guest.token)).data;assert.deepEqual(masked.game.players[0].hand,[]);assert.deepEqual(masked.game.players[0].layout,{});assert(!JSON.stringify(masked).includes(host.token));
 result=await move(host.code,3,{type:'card',card:'recon',cell:12,side:'enemy'},host.token);assert.equal(result.status,200);
 const duplicate=await Promise.all([move(host.code,4,{type:'card',card:'ddos',node:'web',side:'enemy'},host.token),move(host.code,4,{type:'card',card:'ddos',node:'web',side:'enemy'},host.token)]);
 assert.deepEqual(duplicate.map(r=>r.status).sort(),[200,409]);
 const recovered=await get(host.code,host.token);assert.equal(recovered.data.revision,5);assert.equal(recovered.data.game.players[0].money,240);assert.equal(recovered.headers.get('cache-control'),'no-store');
 assert.equal((await get(host.code,guest.token)).data.game.players[1].nodes.web.offline,true);
 result=await move(host.code,5,{type:'surrender'},guest.token);assert.equal(result.status,200);assert.equal(result.data.game.winner,0);
 result=await move(host.code,6,{type:'rematch'},host.token);assert.equal(result.status,200);
 result=await move(host.code,7,{type:'rematch'},guest.token);assert.equal(result.status,200);assert.equal(result.data.game.status,'setup');assert.equal(result.data.game.firstPlayer,1);
 let rateLimited=false;
 for(let i=0;i<15;i++){const r=await post({intent:'create',seatToken:secret()},'spoofed-authorization');if(r.status===429){rateLimited=true;assert.equal(r.headers.get('retry-after'),'60');break;}assert.equal(r.status,201);}
 assert(rateLimited,'Admission rate limiter did not engage');
 const cleanup=await fetch(base+'/__scheduled?cron=17+*+*+*+*');assert(cleanup.ok,'Scheduled cleanup failed');
 console.log('PASS: Worker + real local D1, static assets/CSP, two seats, idempotent admission, hidden data, concurrent attack/CAS, reconnect, surrender, rematch, origin check, admission limiter and scheduled handler.');
}catch(error){console.error(logs);throw error;}
finally{
 if(server.exitCode===null){try{if(process.platform==='win32')server.kill('SIGTERM');else process.kill(-server.pid,'SIGTERM');}catch{}}
 await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);setTimeout(resolve,2000).unref();});
 await rm(state,{recursive:true,force:true});
}
