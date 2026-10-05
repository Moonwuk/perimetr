'use client';
import {useState,useEffect,useRef,useCallback} from 'react';
import {newGame,viewGame,applyAction,botAction,type Game,type View,type Mode,type Action} from './engine';
type Session={code:string;token:string};
import {ONLINE_ENABLED,ONLINE_ORIGIN} from './platform';
import {decodeLocalSave,LOCAL_SAVE_KEY} from './local-save';
import {configureMetricsSession} from './metrics';
type RoomVisibility='private'|'public';
type RoomData={code:string;revision:number;game:View;token?:string;error?:string;presence:[number,number];serverTime:number;expiresAt:number;visibility?:RoomVisibility};
type ClosedRoomData={closed?:boolean;code?:string;error?:string};
const SESSION_KEY='contour-room-v2',TAB_KEY='contour-active-seat';
function readSavedLocal():Game|null {
 try{return decodeLocalSave(localStorage.getItem(LOCAL_SAVE_KEY));}catch{return null;}
}
function readSavedSession():Session|null {
 try{const raw=sessionStorage.getItem(TAB_KEY)||localStorage.getItem(SESSION_KEY)||sessionStorage.getItem('contour-room');if(raw){const s=JSON.parse(raw);if(typeof s.code==='string'&&typeof s.token==='string')return s;}}catch{}
 return null;
}
async function fetchRoom<T=RoomData>(url:string,options:RequestInit={}){
 if(!ONLINE_ENABLED)throw new Error('Сетевые дуэли появятся после запуска сервера. Сейчас доступны бот и игра на одном устройстве.');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{const response=await fetch(ONLINE_ORIGIN+url,{...options,signal:controller.signal,cache:'no-store'});const data=await response.json() as T;return {response,data};}finally{clearTimeout(timeout);}
}
export function useDuel(){
 const [game,setGameState]=useState<Game|null>(null),[remote,setRemote]=useState<RoomData|null>(null),[session,setSession]=useState<Session|null>(null),[resume,setResume]=useState<Session|null>(readSavedSession);
 const [savedLocal,setSavedLocal]=useState<Game|null>(readSavedLocal);
 const [clock,setClock]=useState(()=>Date.now()),[syncedAt,setSyncedAt]=useState(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[curtain,setCurtain]=useState(false),[connection,setConnection]=useState('Подключено');
 const gameRef=useRef<Game|null>(null),remoteRef=useRef<RoomData|null>(null),lock=useRef(false),epoch=useRef(0),uncertain=useRef(false),lastSync=useRef(0),refresh=useRef<()=>void>(()=>{}),pending=useRef<Record<string,string>>({});
 const setGame=useCallback((next:Game|null)=>{gameRef.current=next;setGameState(next);if(next&&next.mode!=='online'){setSavedLocal(next);try{localStorage.setItem(LOCAL_SAVE_KEY,JSON.stringify(next));}catch{}}},[]);
 const viewer=remote?.game.viewer??(game?.mode==='local'?game.turn:0),view=remote?.game??(game?viewGame(game,viewer):null);
 const accept=useCallback((data:RoomData)=>{const old=remoteRef.current;if(!old||old.code!==data.code||data.revision>=old.revision){remoteRef.current=data;setRemote(data);const now=Date.now();lastSync.current=now;setSyncedAt(now);setClock(now);}},[]);
 useEffect(()=>{configureMetricsSession(session);return()=>configureMetricsSession(null);},[session]);
 const saveSession=(s:Session|null)=>{setResume(s);try{if(s){localStorage.setItem(SESSION_KEY,JSON.stringify(s));sessionStorage.setItem(TAB_KEY,JSON.stringify(s));}else {sessionStorage.removeItem(TAB_KEY);localStorage.removeItem(SESSION_KEY);}sessionStorage.removeItem('contour-room');}catch{}};
 useEffect(()=>{if(!session)return;let stopped=false,fetching=false;const myEpoch=epoch.current;
  const poll=async()=>{if(fetching||lock.current||document.hidden)return;fetching=true;try{const {response,data}=await fetchRoom(`/api/rooms?code=${session.code}`,{headers:{Authorization:`Bearer ${session.token}`}});if(stopped||myEpoch!==epoch.current)return;if(!response.ok){if(response.status===403||response.status===404){setError(data.error||'Комната недоступна.');setSession(null);setRemote(null);remoteRef.current=null;saveSession(null);}else setConnection('Переподключаемся…');return;}accept(data);uncertain.current=false;setConnection('Подключено');}catch{if(!stopped&&myEpoch===epoch.current){uncertain.current=true;setConnection('Нет связи. Переподключаемся…');}}finally{fetching=false;}};
  refresh.current=()=>void poll();void poll();const interval=setInterval(()=>{setClock(Date.now());if(Date.now()-lastSync.current>16000){uncertain.current=true;setConnection('Проверяем связь…');}void poll();},2000);
  document.addEventListener('visibilitychange',poll);window.addEventListener('online',poll);return()=>{stopped=true;clearInterval(interval);document.removeEventListener('visibilitychange',poll);window.removeEventListener('online',poll);refresh.current=()=>{};};
 },[session,accept]);
 useEffect(()=>{if(!game||game.mode!=='bot'||game.turn!==1||game.status!=='playing'||curtain)return;const t=setTimeout(()=>{const current=gameRef.current;if(!current||current.turn!==1||current.status!=='playing')return;const next=applyAction(current,1,current.ap===0?{type:'end'}:botAction(current));gameRef.current=next;setGame(next);},650);return()=>clearTimeout(t);},[game,curtain,setGame]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(t);},[notice]);
 const start=(mode:Mode)=>{epoch.current++;setGame(newGame(mode,[mode==='local'?'Компания 01':'Ваша компания',mode==='bot'?'Компания «Вектор»':'Компания 02']));setRemote(null);remoteRef.current=null;setSession(null);setCurtain(mode==='local');setError('');};
 const home=()=>{epoch.current++;gameRef.current=null;remoteRef.current=null;setGame(null);setRemote(null);setSession(null);setCurtain(false);setBusy(false);lock.current=false;setError('');};
 const act=useCallback(async(action:Action)=>{
  if(lock.current)return {ok:false,error:'Подождите завершения действия.'};
  if(session&&uncertain.current){refresh.current();return {ok:false,error:'Сначала восстановим связь с комнатой.'};}
  setError('');const myEpoch=epoch.current;
  if(session){const current=remoteRef.current;if(!current)return {ok:false,error:'Матч ещё загружается.'};lock.current=true;setBusy(true);
   try{
    const send=(revision:number)=>fetchRoom('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.token}`},body:JSON.stringify({intent:'action',code:session.code,revision,action})});
    let {response,data}=await send(current.revision);
    if(myEpoch!==epoch.current)return {ok:false,error:'Вы вышли из матча.'};
    // Deployment has no monetary/AP cost. Retry this exact layout once if the
    // other player's admission/setup advanced the revision before polling.
    // Paid moves are never automatically replayed.
    if(response.status===409&&action.type==='deploy'&&data.game&&data.revision>current.revision&&data.game.matchNumber===current.game.matchNumber&&['waiting','setup'].includes(data.game.status)&&!data.game.players[data.game.viewer].ready){
     accept(data);({response,data}=await send(data.revision));
     if(myEpoch!==epoch.current)return {ok:false,error:'Вы вышли из матча.'};
    }
    if(data.game)accept(data);if(!response.ok){if(response.status>=500||response.status===409&&!data.game)uncertain.current=true;throw new Error(data.error||'Ход не подтверждён.');}setConnection('Подключено');return {ok:true,game:data.game};}
   catch(e){const timeout=!(e instanceof Error)||e.name==='AbortError'||e instanceof TypeError;if(timeout){uncertain.current=true;setConnection('Сверяем последний ход…');}const message=timeout?'Связь прервалась. Дождитесь сверки: повторно деньги не спишутся.':(e as Error).message;if(myEpoch===epoch.current)setError(message);return {ok:false,error:message};}
   finally{if(myEpoch===epoch.current){lock.current=false;setBusy(false);if(uncertain.current)refresh.current();}}}
  const current=gameRef.current;if(!current)return {ok:false,error:'Сначала начните матч.'};try{const actor=current.mode==='local'?current.turn:0,next=applyAction(current,actor,action);gameRef.current=next;setGame(next);if(current.mode==='local'&&next.turn!==current.turn&&next.status!=='finished')setCurtain(true);return {ok:true,game:viewGame(next,actor)};}catch(e){const message=e instanceof Error?e.message:'Ход недоступен.';setError(message);return {ok:false,error:message};}
 },[session,accept,setGame]);
 const openRoom=async(intent:'create'|'join'|'find',name:string,code:string,visibility:RoomVisibility='private')=>{if(lock.current)return false;lock.current=true;setBusy(true);setError('');const myEpoch=epoch.current,excludeCode=intent==='find'?resume?.code:undefined,key=`contour-pending-${intent}-${intent==='join'?code:intent==='find'?(excludeCode||'new'):visibility==='private'?'new':'public'}`;
  try{let secret=pending.current[key];try{secret||=sessionStorage.getItem(key)||'';}catch{}secret||=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');pending.current[key]=secret;try{sessionStorage.setItem(key,secret);}catch{}
   const body={intent,name,seatToken:secret,...(intent==='create'?{visibility}:intent==='join'?{code}:excludeCode?{excludeCode}:{})};
   const {response,data}=await fetchRoom('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(myEpoch!==epoch.current)return false;if(!response.ok)throw new Error(data.error||(intent==='find'?'Свободных открытых комнат пока нет.':'Комната недоступна.'));if(!data.code||!data.token||!data.game)throw new Error('Сервер не подтвердил вход. Повторите попытку: ваш ключ места сохранён.');const s={code:data.code,token:data.token};saveSession(s);delete pending.current[key];try{sessionStorage.removeItem(key);}catch{}uncertain.current=false;setConnection('Подключено');setSession(s);accept(data);setGame(null);setCurtain(false);return true;
  }catch(e){if(myEpoch===epoch.current)setError(e instanceof Error&&e.name!=='AbortError'&&!(e instanceof TypeError)?e.message:'Связь прервалась. Повторите вход: ваш ключ места сохранён.');return false;}finally{if(myEpoch===epoch.current){lock.current=false;setBusy(false);}}};
 const closeRoom=async()=>{
  if(lock.current)return false;
  if(!session||remoteRef.current?.game.viewer!==0){setError('Закрыть комнату может только её создатель.');return false;}
  const closing=session,myEpoch=epoch.current;lock.current=true;setBusy(true);setError('');
  const finish=()=>{if(myEpoch!==epoch.current)return false;epoch.current++;lock.current=false;setBusy(false);uncertain.current=false;setConnection('Подключено');setSession(null);setRemote(null);remoteRef.current=null;setGame(null);setCurtain(false);saveSession(null);setError('');setNotice('Комната закрыта');return true;};
  try{
   let result:Awaited<ReturnType<typeof fetchRoom<ClosedRoomData>>>|undefined;
   try{result=await fetchRoom<ClosedRoomData>('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${closing.token}`},body:JSON.stringify({intent:'close',code:closing.code})});}catch{/* A lost response may still mean that the room was closed. */}
   if(myEpoch!==epoch.current)return false;
   if(result?.response.status===404||result?.response.ok&&result.data.closed===true)return finish();
   if(result&&result.response.status<500)throw new Error(result.data.error||'Сервер не подтвердил закрытие комнаты.');
   // Closing is idempotent, but reconcile once instead of issuing a second mutation.
   uncertain.current=true;setConnection('Проверяем закрытие комнаты…');
   const {response,data}=await fetchRoom(`/api/rooms?code=${closing.code}`,{headers:{Authorization:`Bearer ${closing.token}`}});
   if(myEpoch!==epoch.current)return false;
   if(response.status===404)return finish();
   if(response.ok){accept(data);uncertain.current=false;setConnection('Подключено');throw new Error('Комната ещё открыта. Нажмите «Закрыть комнату» повторно.');}
   throw new Error(data.error||'Не удалось подтвердить закрытие. Проверяем связь с комнатой.');
  }catch(e){if(myEpoch===epoch.current)setError(e instanceof Error&&e.name!=='AbortError'&&!(e instanceof TypeError)?e.message:'Не удалось подтвердить закрытие. Проверяем связь с комнатой.');return false;}
  finally{if(myEpoch===epoch.current){lock.current=false;setBusy(false);if(uncertain.current)refresh.current();}}
 };
 const resumeLocal=()=>{if(!savedLocal)return;epoch.current++;setGame(structuredClone(savedLocal));setRemote(null);remoteRef.current=null;setSession(null);setCurtain(savedLocal.mode==='local'&&savedLocal.status!=='finished');setError('');};
 const resumeRoom=()=>{if(resume){epoch.current++;uncertain.current=true;setConnection('Восстанавливаем место…');setSession(resume);setGame(null);setRemote(null);remoteRef.current=null;}};
 const copy=async()=>{if(!session)return;try{await navigator.clipboard.writeText(`${ONLINE_ORIGIN||location.origin}/?room=${session.code}`);setNotice('Приглашение скопировано');}catch{setNotice(`Код комнаты: ${session.code}`);}};
 const otherSeen=remote?.presence?.[1-viewer]??0,otherAge=remote?Math.max(0,remote.serverTime-otherSeen)+Math.max(0,clock-syncedAt):Infinity;
 const opponentStatus=view?.status==='waiting'?'Ждём второго игрока':otherAge<15000?'Соперник на связи':otherAge<60000?'Соперник отошёл':'Соперник не на связи';
 return {savedLocal,resumeLocal,view,viewer,session,resume,roomVisibility:remote?.visibility??'private',busy:busy||!!session&&connection!=='Подключено',error,setError,notice,setNotice,curtain,setCurtain,connection,opponentStatus,expiresAt:remote?.expiresAt,revision:remote?.revision,reconnect:()=>refresh.current(),start,home,act,openRoom,closeRoom,resumeRoom,copy};
}
