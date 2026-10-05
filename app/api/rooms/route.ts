import { isAllowedApiOrigin } from '@/lib/server/api-origin';
import { roomDb } from '@/db/rooms';
import { recordRoomMetric, recordActionMetric, recordErrorMetric } from '@/lib/server/metrics';
import { newGame, applyAction, viewGame, upgradeGame, type Game, type Action } from '@/lib/game/engine';
export const dynamic='force-dynamic';
type Row={code:string;state:string;host_hash:string;guest_hash:string|null;revision:number;expires_at:number;host_seen_at:number;guest_seen_at:number;visibility:'public'|'private'};
const json=(data:unknown,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const hash=async(token:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const token=()=>crypto.randomUUID()+crypto.randomUUID();
const seatPattern=/^(?:[a-f0-9]{64}|[a-f0-9-]{72})$/;
const codePattern=/^[A-HJ-NP-Z2-9]{7}$/;
const availableFor=60_000;
const roomMissing='Комната закрыта, не найдена или срок её действия истёк.';
function playerName(s:unknown,fallback:string){if(typeof s!=='string')return fallback;return s.replace(/[\x00-\x1f<>]/g,'').trim().slice(0,24)||fallback;}
async function readRoom(code:string){if(!codePattern.test(code))return null;return roomDb().prepare('SELECT * FROM rooms WHERE code = ? AND expires_at > ?').bind(code,Date.now()).first<Row>();}
async function actorFor(request:Request,row:Row){const raw=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';if(raw.length<50||raw.length>100)return -1;const h=await hash(raw);return h===row.host_hash?0:h===row.guest_hash?1:-1;}
function payload(row:Row,g:Game,actor:number){return {code:row.code,visibility:row.visibility,revision:row.revision,game:viewGame(g,actor),expiresAt:row.expires_at,serverTime:Date.now(),presence:[row.host_seen_at,row.guest_seen_at]};}
export async function GET(request:Request){
 if(!isAllowedApiOrigin(request))return json({error:'Недопустимый источник запроса.'},403);
 try{const code=new URL(request.url).searchParams.get('code')??'';const row=await readRoom(code);if(!row)return json({error:roomMissing},404);const actor=await actorFor(request,row);if(actor<0)return json({error:'Нет доступа к этому месту игрока.'},403);const field=actor===0?'host_seen_at':'guest_seen_at';const now=Date.now();if(now-row[field]>=15000){await roomDb().prepare(`UPDATE rooms SET ${field} = ? WHERE code = ? AND ${field} <= ?`).bind(now,row.code,now-15000).run();row[field]=now;}return json(payload(row,upgradeGame(JSON.parse(row.state)),actor));}
 catch(e){console.error('room read failed',e instanceof Error?e.message:'unknown');return json({error:'Не удалось связаться с комнатой. Попробуйте ещё раз.'},503);}
}
export async function handleRoomPost(request:Request,admissionLimit?:()=>Promise<boolean>){
 try{
  if(!isAllowedApiOrigin(request))return json({error:'Недопустимый источник запроса.'},403);
  if(Number(request.headers.get('content-length')??0)>4096)return json({error:'Слишком большой запрос.'},413);
  let raw:string|null;try{raw=await readBoundedBody(request);}catch{return json({error:'Некорректная кодировка запроса.'},400);}
  if(raw===null)return json({error:'Слишком большой запрос.'},413);
  let b:Record<string,unknown>;try{b=JSON.parse(raw);}catch{return json({error:'Некорректный запрос.'},400);}
  if(!b||typeof b!=='object'||Array.isArray(b))return json({error:'Некорректный запрос.'},400);
  const db=roomDb();
  if((b.intent==='create'||b.intent==='join'||b.intent==='find')&&b.seatToken!==undefined&&(typeof b.seatToken!=='string'||!seatPattern.test(b.seatToken)))return json({error:'Некорректный ключ восстановления.'},400);
  if((b.intent==='create'||b.intent==='join'||b.intent==='find')&&admissionLimit&&!(await admissionLimit()))return json({error:'Слишком много попыток создать комнату или войти. Подождите минуту.'},429,{'Retry-After':'60'});
  if(b.intent==='create'&&b.visibility!==undefined&&b.visibility!=='private'&&b.visibility!=='public')return json({error:'Некорректный тип комнаты.'},400);
  if(b.intent==='find'&&b.excludeCode!==undefined&&(typeof b.excludeCode!=='string'||!codePattern.test(b.excludeCode)))return json({error:'Некорректный код комнаты.'},400);
  if(b.intent==='create'){
   const secret=typeof b.seatToken==='string'?b.seatToken:token(),hostHash=await hash(secret);
   const existing=await db.prepare('SELECT * FROM rooms WHERE host_hash = ? AND expires_at > ?').bind(hostHash,Date.now()).first<Row>();
   if(existing)return json({...payload(existing,upgradeGame(JSON.parse(existing.state)),0),token:secret});
   const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=crypto.getRandomValues(new Uint8Array(7));
   const code=Array.from(bytes,n=>alphabet[n%alphabet.length]).join(''),seed=crypto.getRandomValues(new Uint32Array(1))[0];
   const g=newGame('online',[playerName(b.name,'Оператор 01'),'Оператор 02'],seed);
   await db.batch([db.prepare('DELETE FROM rooms WHERE expires_at <= ?').bind(Date.now()),db.prepare('INSERT OR IGNORE INTO rooms (code,state,host_hash,guest_hash,revision,expires_at,host_seen_at,visibility) VALUES (?,?,?,NULL,0,?,?,?)').bind(code,JSON.stringify(g),hostHash,Date.now()+24*60*60*1000,Date.now(),b.visibility==='public'?'public':'private')]);
   const saved=await db.prepare('SELECT * FROM rooms WHERE host_hash = ? AND expires_at > ?').bind(hostHash,Date.now()).first<Row>();
   if(!saved)return json({error:'Не удалось создать комнату. Повторите попытку: место не потеряется.'},503);
   await recordRoomMetric(saved,upgradeGame(JSON.parse(saved.state)),'created',0);
   return json({...payload(saved,upgradeGame(JSON.parse(saved.state)),0),token:secret},201);
  }
  if(b.intent==='find'){
   const secret=typeof b.seatToken==='string'?b.seatToken:token(),guestHash=await hash(secret);
   // Recovery runs first: a lost response must not consume a second room.
   const recover=async()=>{
    const existing=await db.prepare('SELECT * FROM rooms WHERE guest_hash = ? AND expires_at > ? ORDER BY expires_at DESC LIMIT 1').bind(guestHash,Date.now()).first<Row>();
    return existing?json({...payload(existing,upgradeGame(JSON.parse(existing.state)),1),token:secret}):null;
   };
   const recovered=await recover();if(recovered)return recovered;
   for(let attempt=0;attempt<5;attempt++){
    const now=Date.now();
    const candidate=await db.prepare("SELECT * FROM rooms WHERE visibility = 'public' AND guest_hash IS NULL AND expires_at > ? AND host_seen_at >= ? AND host_hash != ? AND code != ? AND json_extract(state, '$.status') = 'waiting' ORDER BY host_seen_at DESC, code LIMIT 1").bind(now,now-availableFor,guestHash,b.excludeCode??'').first<Row>();
    if(!candidate)break;
    const game=upgradeGame(JSON.parse(candidate.state));
    game.players[1].name=playerName(b.name,'Оператор 02');game.status=game.players.every(p=>p.ready)?'playing':'setup';if(game.status==='playing')game.turn=game.firstPlayer;
    // SQLite/D1 serializes this statement: both room occupancy and token admission
    // are checked atomically, including concurrent retries that picked other rooms.
    const joined=await db.prepare("UPDATE rooms SET guest_hash = ?, state = ?, guest_seen_at = ?, revision = revision + 1 WHERE code = ? AND guest_hash IS NULL AND revision = ? AND visibility = 'public' AND expires_at > ? AND host_seen_at >= ? AND NOT EXISTS (SELECT 1 FROM rooms WHERE guest_hash = ? AND expires_at > ?)").bind(guestHash,JSON.stringify(game),now,candidate.code,candidate.revision,now,now-availableFor,guestHash,now).run();
    if(joined.meta.changes===1){candidate.guest_hash=guestHash;candidate.guest_seen_at=now;candidate.revision++;await recordRoomMetric(candidate,game,'joined',1);return json({...payload(candidate,game,1),token:secret});}
    const retried=await recover();if(retried)return retried;
   }
   const retried=await recover();if(retried)return retried;
   return json({error:'Свободных открытых комнат пока нет. Создайте свою или попробуйте позже.'},404);
  }
  const row=await readRoom(typeof b.code==='string'?b.code:'');if(!row)return json({error:roomMissing},404);
  if(b.intent==='close'){
   if(await actorFor(request,row)!==0)return json({error:'Закрыть комнату может только её создатель.'},403);
   // Capture the authoritative final state atomically with deletion: a concurrent
   // move may have committed since the initial authorization read.
   const removed=await db.prepare('DELETE FROM rooms WHERE code = ? AND host_hash = ? RETURNING *').bind(row.code,row.host_hash).first<Row>();
   if(removed)await recordRoomMetric(removed,upgradeGame(JSON.parse(removed.state)),'closed',0);
   return json({closed:true,code:row.code});
  }
  const g=upgradeGame(JSON.parse(row.state) as Game);
  if(b.intent==='join'){
   const secret=typeof b.seatToken==='string'?b.seatToken:token(),guestHash=await hash(secret);
   if(row.guest_hash===guestHash)return json({...payload(row,g,1),token:secret});
   if(row.host_hash===guestHash)return json({error:'Это ключ первого игрока. Вернитесь в своё место.'},409);
   if(row.guest_hash||g.status!=='waiting')return json({error:'В комнате уже есть два игрока.'},409);
   g.players[1].name=playerName(b.name,'Оператор 02');g.status=g.players.every(p=>p.ready)?'playing':'setup';if(g.status==='playing')g.turn=g.firstPlayer;
   const joinedAt=Date.now();
   const joined=await db.prepare('UPDATE rooms SET guest_hash = ?, state = ?, guest_seen_at = ?, revision = revision + 1 WHERE code = ? AND guest_hash IS NULL AND revision = ?').bind(guestHash,JSON.stringify(g),joinedAt,row.code,row.revision).run();
   if(joined.meta.changes!==1){const latest=await readRoom(row.code);if(latest?.guest_hash===guestHash)return json({...payload(latest,upgradeGame(JSON.parse(latest.state)),1),token:secret});return json({error:'Это место уже занято. Повторите вход после обновления.'},409);}
   row.guest_seen_at=joinedAt;row.revision++;await recordRoomMetric(row,g,'joined',1);return json({...payload(row,g,1),token:secret});
  }
  if(b.intent!=='action')return json({error:'Неизвестное действие.'},400);
  const actor=await actorFor(request,row);if(actor<0)return json({error:'Нет доступа к этому месту игрока.'},403);
  if(b.revision!==row.revision){await recordErrorMetric(row,g,actor,'revision_conflict');return json({error:'Матч обновился. Повторите действие после обновления поля.',...payload(row,g,actor)},409);}
  const action=b.action as Action;if(!action||typeof action!=='object'||!['card','scan','investigate','isolate','restore','cleanse','draw','exchange','deploy','end','surrender','reserve','rematch'].includes(action.type)){await recordErrorMetric(row,g,actor,'invalid_action');return json({error:'Некорректное игровое действие.'},400);}
  let next:Game;try{next=applyAction(g,actor,action);}catch(e){await recordErrorMetric(row,g,actor,'action_rejected');return json({error:e instanceof Error?e.message:'Невозможно выполнить действие.'},400);}
  const updated=await db.prepare('UPDATE rooms SET state = ?, revision = revision + 1 WHERE code = ? AND revision = ?').bind(JSON.stringify(next),row.code,row.revision).run();
  if(updated.meta.changes!==1){await recordErrorMetric(row,g,actor,'concurrent_update');const latest=await readRoom(row.code);return json({error:'Другой ход уже сохранён. Поле обновлено.',...(latest?payload(latest,upgradeGame(JSON.parse(latest.state)),actor):{})},409);}
  row.revision++;await recordActionMetric(row,g,next,actor,action);return json(payload(row,next,actor));
 }catch(e){console.error('room write failed',e instanceof Error?e.message:'unknown');return json({error:'Комната временно недоступна. Ваш ход не подтверждён. Попробуйте ещё раз.'},503);}
}

export async function POST(request:Request){return handleRoomPost(request);}

async function readBoundedBody(request:Request):Promise<string|null>{
 if(!request.body)return '';
 const reader=request.body.getReader(),parts:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return null;}parts.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
