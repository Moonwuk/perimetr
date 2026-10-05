import { roomDb } from '@/db/rooms';
import { CARDS, RESERVE_COST, incomeOf, type Action, type CardId, type Game, type PauseDecision } from '@/lib/game/engine';
export const METRICS_RETENTION_DAYS=30;
export const metricsCutoff=()=>Date.now()-METRICS_RETENTION_DAYS*86_400_000;
export type MetricRoom={code:string;host_hash:string;visibility:'public'|'private';revision:number};
export type DragMetric={type:'card_drag';card:CardId;outcome:'submitted'|'cancelled'|'invalid';durationMs?:number};
type ErrorKind='revision_conflict'|'invalid_action'|'action_rejected'|'concurrent_update';
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
export const metricMatchId=(room:MetricRoom,game:Game)=>digest(`${room.code}:${room.host_hash}:${game.matchNumber}`);
async function bestEffort(write:()=>Promise<unknown>){try{await write();}catch{console.error('metrics_write_unavailable');}}
function snapshot(db:D1Database,id:string,room:MetricRoom,g:Game,now:number,closed=false,reason:string|null=null){
 const status=closed&&g.status!=='finished'?'abandoned':g.status;
 const ended=status==='finished'||status==='abandoned';
 return db.prepare(`INSERT INTO metrics_matches (id,match_number,visibility,revision,status,round,first_player,winner,money0,money1,income0,income1,created_at,updated_at,started_at,ended_at,finish_reason)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,status=excluded.status,round=excluded.round,winner=excluded.winner,money0=excluded.money0,money1=excluded.money1,income0=excluded.income0,income1=excluded.income1,updated_at=excluded.updated_at,started_at=COALESCE(metrics_matches.started_at,excluded.started_at),ended_at=COALESCE(metrics_matches.ended_at,excluded.ended_at),finish_reason=COALESCE(metrics_matches.finish_reason,excluded.finish_reason)
 WHERE excluded.revision >= metrics_matches.revision AND metrics_matches.status != 'abandoned' AND (metrics_matches.status != 'finished' OR excluded.status = 'finished')`).bind(id,g.matchNumber,room.visibility,room.revision,status,g.round,g.firstPlayer,g.winner,g.players[0].money,g.players[1].money,incomeOf(g.players[0]),incomeOf(g.players[1]),now,now,g.startedAt??(g.status==='playing'?now:null),ended?now:null,ended?(g.finishReason??reason??'finished'):null);
}
function event(db:D1Database,id:string,matchId:string,room:MetricRoom,g:Game,actor:number|null,type:string,data:Record<string,unknown>,now:number,source='server'){
 return db.prepare('INSERT OR IGNORE INTO metrics_events (id,match_id,at,source,type,actor,revision,round,data) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,matchId,now,source,type,actor,room.revision,g.round,JSON.stringify(data));
}
export async function recordRoomMetric(room:MetricRoom,g:Game,type:'created'|'joined'|'closed',actor:number){
 await bestEffort(async()=>{const db=roomDb(),id=await metricMatchId(room,g),now=Date.now();await db.batch([snapshot(db,id,room,g,now,type==='closed',type==='closed'?'closed':null),event(db,`${id}:${room.revision}:${type}`,id,room,g,actor,type,{},now)]);});
}
export async function recordActionMetric(room:MetricRoom,before:Game,next:Game,actor:number,action:Action){
 await bestEffort(async()=>{
  const db=roomDb(),oldId=await metricMatchId(room,before),newId=await metricMatchId(room,next),now=Date.now();
  const card='card' in action&&Object.prototype.hasOwnProperty.call(CARDS,action.card)?action.card:undefined;
  const data={action:action.type,...(card?{card}:{}),moneySpent:action.type==='card'?CARDS[action.card].money:action.type==='reserve'?RESERVE_COST:0,moneyDelta:next.players[actor].money-before.players[actor].money,apSpent:action.type==='end'||action.type==='rematch'?0:Math.max(0,before.ap-next.ap)};
  const writes=[event(db,`${oldId}:${room.revision}:action`,oldId,room,before,actor,'action',data,now),snapshot(db,newId,room,next,now,false,action.type==='surrender'?'surrender':null)];
  if(oldId!==newId)writes.push(snapshot(db,oldId,room,before,now));
  await db.batch(writes);
 });
}
// This outcome is decided by the server's presence CAS, never a client game action.
export async function recordDisconnectMetric(room:MetricRoom,before:Game,next:Game,actor:number){
 await bestEffort(async()=>{const db=roomDb(),id=await metricMatchId(room,next),now=Date.now();await db.batch([
  snapshot(db,id,room,next,now,false,'disconnect'),
  event(db,`${id}:${room.revision}:disconnect`,id,room,before,actor,'disconnect',{winner:actor},now),
 ]);});
}
export async function recordPauseMetric(room:MetricRoom,g:Game,actor:number,decision:PauseDecision){
 await bestEffort(async()=>{const db=roomDb(),id=await metricMatchId(room,g),now=Date.now();await db.batch([
  snapshot(db,id,room,g,now),event(db,`${id}:${room.revision}:pause`,id,room,g,actor,'pause',{decision},now),
 ]);});
}
export async function recordErrorMetric(room:MetricRoom,g:Game,actor:number,error:ErrorKind){
 await bestEffort(async()=>{const db=roomDb(),id=await metricMatchId(room,g),now=Date.now();await db.batch([snapshot(db,id,room,g,now),event(db,crypto.randomUUID(),id,room,g,actor,'request_error',{error},now)]);});
}
export async function recordDragMetrics(room:MetricRoom,g:Game,actor:number,events:DragMetric[]){
 const db=roomDb(),id=await metricMatchId(room,g),now=Date.now();
 await db.batch([snapshot(db,id,room,g,now),...events.map(e=>event(db,crypto.randomUUID(),id,room,g,actor,'card_drag',{card:e.card,outcome:e.outcome,...(e.durationMs===undefined?{}:{durationMs:e.durationMs})},now,'client'))]);
}
export async function cleanupMetrics(db:D1Database){
 const now=Date.now(),cutoff=metricsCutoff();
 // A room lives at most 24h. Snapshots abandoned without a close are finalized on cleanup.
 await db.batch([
  db.prepare("UPDATE metrics_matches SET status = 'abandoned', ended_at = ?, finish_reason = 'expired' WHERE status NOT IN ('finished','abandoned') AND updated_at < ?").bind(now,now-86_400_000),
  db.prepare('DELETE FROM metrics_events WHERE at < ?').bind(cutoff),
  db.prepare('DELETE FROM metrics_matches WHERE updated_at < ?').bind(cutoff),
 ]);
}
