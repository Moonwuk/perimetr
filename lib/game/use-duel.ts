'use client';
import {useState,useEffect,useRef,useCallback} from 'react';
import {newGame,viewGame,applyAction,botAction,type Game,type View,type Mode,type Action} from './engine';
type Session={code:string;token:string};
import {IS_ANDROID,ONLINE_ENABLED,ONLINE_ORIGIN} from './platform';
import {decodeLocalSave,LOCAL_SAVE_KEY} from './local-save';
type RoomData={code:string;revision:number;game:View;token?:string;error?:string;presence:[number,number];serverTime:number;expiresAt:number};
const SESSION_KEY='contour-room-v2',TAB_KEY='contour-active-seat';
async function fetchRoom(url:string,options:RequestInit={}){
 if(!ONLINE_ENABLED)throw new Error('Сетевые дуэли появятся после запуска сервера. Сейчас доступны бот и игра на одном устройстве.');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{const response=await fetch(ONLINE_ORIGIN+url,{...options,signal:controller.signal,cache:'no-store'});const data=await response.json() as RoomData;return {response,data};}finally{clearTimeout(timeout);}
}
export function useDuel(){
 const [game,setGame]=useState<Game|null>(null),[remote,setRemote]=useState<RoomData|null>(null),[session,setSession]=useState<Session|null>(null),[resume,setResume]=useState<Session|null>(null);
 const [savedLocal,setSavedLocal]=useState<Game|null>(null);
 useEffect(()=>{if(IS_ANDROID)try{setSavedLocal(decodeLocalSave(localStorage.getItem(LOCAL_SAVE_KEY)));}catch{}},[]);
 useEffect(()=>{if(IS_ANDROID&&game&&game.mode!=='online')try{localStorage.setItem(LOCAL_SAVE_KEY,JSON.stringify(game));setSavedLocal(game);}catch{}},[game]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[curtain,setCurtain]=useState(false),[connection,setConnection]=useState('Подключено'),[,setTick]=useState(0);
 const gameRef=useRef(game),remoteRef=useRef(remote),lock=useRef(false),epoch=useRef(0),uncertain=useRef(false),lastSync=useRef(0),refresh=useRef<()=>void>(()=>{}),pending=useRef<Record<string,string>>({});gameRef.current=game;remoteRef.current=remote;
 const viewer=remote?.game.viewer??(game?.mode==='local'?game.turn:0),view=remote?.game??(game?viewGame(game,viewer):null);
 const accept=useCallback((data:RoomData)=>{const old=remoteRef.current;if(!old||old.code!==data.code||data.revision>=old.revision){remoteRef.current=data;setRemote(data);lastSync.current=Date.now();}},[]);
 const saveSession=(s:Session|null)=>{setResume(s);try{if(s){localStorage.setItem(SESSION_KEY,JSON.stringify(s));sessionStorage.setItem(TAB_KEY,JSON.stringify(s));}else {sessionStorage.removeItem(TAB_KEY);localStorage.removeItem(SESSION_KEY);}sessionStorage.removeItem('contour-room');}catch{}};
 useEffect(()=>{try{const saved=sessionStorage.getItem(TAB_KEY)||localStorage.getItem(SESSION_KEY)||sessionStorage.getItem('contour-room');if(saved){const s=JSON.parse(saved);if(typeof s.code==='string'&&typeof s.token==='string')setResume(s);}}catch{}},[]);
 useEffect(()=>{if(!session)return;let stopped=false,fetching=false;const myEpoch=epoch.current;
  const poll=async()=>{if(fetching||lock.current||document.hidden)return;fetching=true;try{const {response,data}=await fetchRoom(`/api/rooms?code=${session.code}`,{headers:{Authorization:`Bearer ${session.token}`}});if(stopped||myEpoch!==epoch.current)return;if(!response.ok){if(response.status===403||response.status===404){setError(data.error||'Комната недоступна.');setSession(null);setRemote(null);saveSession(null);}else setConnection('Переподключаемся…');return;}accept(data);uncertain.current=false;setConnection('Подключено');}catch{if(!stopped&&myEpoch===epoch.current){uncertain.current=true;setConnection('Нет связи. Переподключаемся…');}}finally{fetching=false;}};
  refresh.current=()=>void poll();void poll();const interval=setInterval(()=>{setTick(t=>t+1);if(Date.now()-lastSync.current>16000){uncertain.current=true;setConnection('Проверяем связь…');}void poll();},2000);
  document.addEventListener('visibilitychange',poll);window.addEventListener('online',poll);return()=>{stopped=true;clearInterval(interval);document.removeEventListener('visibilitychange',poll);window.removeEventListener('online',poll);refresh.current=()=>{};};
 },[session,accept]);
 useEffect(()=>{if(!game||game.mode!=='bot'||game.turn!==1||game.status!=='playing'||curtain)return;const t=setTimeout(()=>{const current=gameRef.current;if(!current||current.turn!==1||current.status!=='playing')return;const next=applyAction(current,1,current.ap===0?{type:'end'}:botAction(current));gameRef.current=next;setGame(next);},650);return()=>clearTimeout(t);},[game,curtain]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(t);},[notice]);
 const start=(mode:Mode)=>{epoch.current++;setGame(newGame(mode,[mode==='local'?'Компания 01':'Ваша компания',mode==='bot'?'Компания «Вектор»':'Компания 02']));setRemote(null);setSession(null);setCurtain(mode==='local');setError('');};
 const home=()=>{epoch.current++;gameRef.current=null;remoteRef.current=null;setGame(null);setRemote(null);setSession(null);setCurtain(false);setBusy(false);lock.current=false;setError('');};
 const act=useCallback(async(action:Action)=>{
  if(lock.current)return {ok:false,error:'Подождите завершения действия.'};
  if(session&&uncertain.current){refresh.current();return {ok:false,error:'Сначала восстановим связь с комнатой.'};}
  setError('');const myEpoch=epoch.current;
  if(session){const current=remoteRef.current;if(!current)return {ok:false,error:'Матч ещё загружается.'};lock.current=true;setBusy(true);
   try{const {response,data}=await fetchRoom('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.token}`},body:JSON.stringify({intent:'action',code:session.code,revision:current.revision,action})});if(myEpoch!==epoch.current)return {ok:false,error:'Вы вышли из матча.'};if(data.game)accept(data);if(!response.ok){if(response.status>=500||response.status===409&&!data.game)uncertain.current=true;throw new Error(data.error||'Ход не подтверждён.');}setConnection('Подключено');return {ok:true,game:data.game};}
   catch(e){const timeout=!(e instanceof Error)||e.name==='AbortError'||e instanceof TypeError;if(timeout){uncertain.current=true;setConnection('Сверяем последний ход…');}const message=timeout?'Связь прервалась. Дождитесь сверки: повторно деньги не спишутся.':(e as Error).message;if(myEpoch===epoch.current)setError(message);return {ok:false,error:message};}
   finally{if(myEpoch===epoch.current){lock.current=false;setBusy(false);if(uncertain.current)refresh.current();}}}
  const current=gameRef.current;if(!current)return {ok:false,error:'Сначала начните матч.'};try{const actor=current.mode==='local'?current.turn:0,next=applyAction(current,actor,action);gameRef.current=next;setGame(next);if(current.mode==='local'&&next.turn!==current.turn&&next.status!=='finished')setCurtain(true);return {ok:true,game:viewGame(next,actor)};}catch(e){const message=e instanceof Error?e.message:'Ход недоступен.';setError(message);return {ok:false,error:message};}
 },[session,accept]);
 const openRoom=async(intent:'create'|'join',name:string,code:string)=>{if(lock.current)return false;lock.current=true;setBusy(true);setError('');const myEpoch=epoch.current,key=`contour-pending-${intent}-${intent==='join'?code:'new'}`;
  try{let secret=pending.current[key];try{secret||=sessionStorage.getItem(key)||'';}catch{}secret||=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');pending.current[key]=secret;try{sessionStorage.setItem(key,secret);}catch{}
   const {response,data}=await fetchRoom('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({intent,name,code,seatToken:secret})});if(myEpoch!==epoch.current)return false;if(!response.ok)throw new Error(data.error||'Комната недоступна.');const s={code:data.code,token:data.token!};saveSession(s);delete pending.current[key];try{sessionStorage.removeItem(key);}catch{}uncertain.current=false;setConnection('Подключено');setSession(s);accept(data);setGame(null);setCurtain(false);return true;
  }catch(e){setError(e instanceof Error&&e.name!=='AbortError'?e.message:'Время ожидания истекло. Повторите вход: ваш ключ места сохранён.');return false;}finally{if(myEpoch===epoch.current){lock.current=false;setBusy(false);}}};
 const resumeLocal=()=>{if(!savedLocal)return;epoch.current++;setGame(structuredClone(savedLocal));setRemote(null);setSession(null);setCurtain(savedLocal.mode==='local'&&savedLocal.status!=='finished');setError('');};
 const resumeRoom=()=>{if(resume){epoch.current++;uncertain.current=true;setConnection('Восстанавливаем место…');setSession(resume);setGame(null);setRemote(null);remoteRef.current=null;}};
 const copy=async()=>{if(!session)return;try{await navigator.clipboard.writeText(`${ONLINE_ORIGIN||location.origin}/?room=${session.code}`);setNotice('Приглашение скопировано');}catch{setNotice(`Код комнаты: ${session.code}`);}};
 const otherSeen=remote?.presence?.[1-viewer]??0,otherAge=remote?Math.max(0,remote.serverTime-otherSeen)+Math.max(0,Date.now()-lastSync.current):Infinity;
 const opponentStatus=view?.status==='waiting'?'Ждём второго игрока':otherAge<15000?'Соперник на связи':otherAge<60000?'Соперник отошёл':'Соперник не на связи';
 return {savedLocal,resumeLocal,view,viewer,session,resume,busy:busy||!!session&&connection!=='Подключено',error,setError,notice,setNotice,curtain,setCurtain,connection,opponentStatus,expiresAt:remote?.expiresAt,revision:remote?.revision,reconnect:()=>refresh.current(),start,home,act,openRoom,resumeRoom,copy};
}
