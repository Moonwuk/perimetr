import { isAllowedApiOrigin } from '@/lib/server/api-origin';
import { env } from 'cloudflare:workers';
import { roomDb } from '@/db/rooms';
import { CARDS, upgradeGame, type Game } from '@/lib/game/engine';
import { METRICS_RETENTION_DAYS, metricsCutoff, recordDragMetrics, type DragMetric, type MetricRoom } from '@/lib/server/metrics';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hash=async(value:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
async function sameSecret(a:string,b:string){const [x,y]=await Promise.all([hash(a),hash(b)]);let difference=0;for(let i=0;i<x.length;i++)difference|=x[i]^y[i];return difference===0;}
const iso=(v:unknown)=>v==null?null:new Date(Number(v)).toISOString();
type MatchRow={id:string;match_number:number;visibility:string;status:string;round:number;first_player:number;winner:number|null;money0:number;money1:number;income0:number;income1:number;created_at:number;updated_at:number;started_at:number|null;ended_at:number|null;finish_reason:string|null};
type EventRow={id:string;match_id:string;at:number;source:string;type:string;actor:number|null;revision:number;round:number;data:string};
export async function handleMetricsExport(request:Request,exportToken?:string){
 if(!isAllowedApiOrigin(request))return json({error:'Недопустимый источник запроса.'},403);
 if(!exportToken)return json({error:'Экспорт метрик ещё не настроен владельцем.'},503);
 const supplied=request.headers.get('authorization')?.match(/^Bearer (.{1,512})$/)?.[1];
 if(!supplied||!await sameSecret(supplied,exportToken))return json({error:'Нужен ключ владельца для экспорта метрик.'},401);
 const url=new URL(request.url),now=Date.now(),cutoff=metricsCutoff();
 const parse=(name:string,fallback:number)=>url.searchParams.has(name)?Date.parse(url.searchParams.get(name)!):fallback;
 const since=parse('since',cutoff),until=parse('until',now);
 if(!Number.isFinite(since)||!Number.isFinite(until)||since>=until||until-since>METRICS_RETENTION_DAYS*86_400_000+1000||since<cutoff-60_000||until>now+60_000)return json({error:'Укажите корректный период в пределах последних 30 дней.'},400);
 try{
  const db=roomDb(),matchLimit=100,eventLimit=5000;
  const matches=await db.prepare('SELECT * FROM metrics_matches WHERE updated_at >= ? AND created_at <= ? ORDER BY updated_at DESC,id LIMIT ?').bind(since,until,matchLimit+1).all<MatchRow>();
  const selected=matches.results.slice(0,matchLimit),ids=selected.map(m=>m.id);
  const events=ids.length?await db.prepare('SELECT * FROM metrics_events WHERE at >= ? AND at <= ? AND match_id IN (SELECT value FROM json_each(?)) ORDER BY at DESC,id LIMIT ?').bind(since,until,JSON.stringify(ids),eventLimit+1).all<EventRow>():{results:[]};
  return json({schemaVersion:1,generatedAt:new Date(now).toISOString(),range:{since:new Date(since).toISOString(),until:new Date(until).toISOString()},retentionDays:METRICS_RETENTION_DAYS,limits:{matches:matchLimit,events:eventLimit},truncated:matches.results.length>matchLimit||events.results.length>eventLimit,
   matches:selected.map(m=>({id:m.id,matchNumber:m.match_number,visibility:m.visibility,status:m.status,round:m.round,firstPlayer:m.first_player,winner:m.winner,money:[m.money0,m.money1],income:[m.income0,m.income1],createdAt:iso(m.created_at),updatedAt:iso(m.updated_at),startedAt:iso(m.started_at),endedAt:iso(m.ended_at),durationMs:m.started_at==null?null:Math.max(0,(m.ended_at??m.updated_at)-m.started_at),finishReason:m.finish_reason})),
   events:events.results.slice(0,eventLimit).map(e=>({id:e.id,matchId:e.match_id,at:iso(e.at),source:e.source,type:e.type,actor:e.actor,revision:e.revision,round:e.round,...JSON.parse(e.data)})),
  });
 }catch{console.error('metrics_export_unavailable');return json({error:'Метрики временно недоступны.'},503);}
}
export async function GET(request:Request){return handleMetricsExport(request,(env as unknown as {METRICS_EXPORT_TOKEN?:string}).METRICS_EXPORT_TOKEN);}
export async function POST(request:Request){
 if(!isAllowedApiOrigin(request))return json({error:'Недопустимый источник запроса.'},403);
 if(Number(request.headers.get('content-length')??0)>4096)return json({error:'Слишком большой запрос.'},413);
 let body:Record<string,unknown>;
 try{
  if(!request.body)return json({error:'Некорректный запрос.'},400);
  const reader=request.body.getReader(),parts:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return json({error:'Слишком большой запрос.'},413);}parts.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
  body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }catch{return json({error:'Некорректный запрос.'},400);}
 if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(k=>!['code','events'].includes(k))||typeof body.code!=='string'||!/^[A-HJ-NP-Z2-9]{7}$/.test(body.code)||!Array.isArray(body.events)||body.events.length<1||body.events.length>10)return json({error:'Некорректные события.'},400);
 for(const event of body.events){
  if(!event||typeof event!=='object'||Array.isArray(event)||Object.keys(event).some(k=>!['type','card','outcome','durationMs'].includes(k))||event.type!=='card_drag'||typeof event.card!=='string'||!Object.prototype.hasOwnProperty.call(CARDS,event.card)||!['submitted','cancelled','invalid'].includes(event.outcome)||event.durationMs!==undefined&&(!Number.isInteger(event.durationMs)||event.durationMs<0||event.durationMs>60_000))return json({error:'Некорректное событие.'},400);
 }
 try{
  const db=roomDb(),row=await db.prepare('SELECT * FROM rooms WHERE code = ? AND expires_at > ?').bind(body.code,Date.now()).first<MetricRoom&{state:string;guest_hash:string|null}>();
  if(!row)return json({error:'Комната закрыта или не найдена.'},404);
  const raw=request.headers.get('authorization')?.match(/^Bearer (.{50,100})$/)?.[1];if(!raw)return json({error:'Нет доступа к этому месту игрока.'},403);
  const key=Array.from(await hash(raw),n=>n.toString(16).padStart(2,'0')).join(''),actor=key===row.host_hash?0:key===row.guest_hash?1:-1;
  if(actor<0)return json({error:'Нет доступа к этому месту игрока.'},403);
  await recordDragMetrics(row,upgradeGame(JSON.parse(row.state) as Game),actor,body.events as DragMetric[]);
  return json({accepted:body.events.length},202);
 }catch{console.error('metrics_ingest_unavailable');return json({error:'Метрики временно недоступны.'},503);}
}
