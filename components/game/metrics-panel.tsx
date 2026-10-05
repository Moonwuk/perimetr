'use client';

import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import {Download,LoaderCircle} from 'lucide-react';
import {ONLINE_ORIGIN} from '@/lib/game/platform';
import './metrics-panel.css';

export function MetricsPanel(){
 const keyId=useId();
 const request=useRef<AbortController|null>(null);
 const [ownerKey,setOwnerKey]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [failed,setFailed]=useState(false);
 useEffect(()=>()=>request.current?.abort(),[]);

 async function downloadReport(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy||!ownerKey.trim())return;
  setBusy(true);
  setMessage('');
  setFailed(false);
  const controller=new AbortController();
  request.current=controller;
  const timeout=window.setTimeout(()=>controller.abort(),15000);
  let url:string|undefined;
  let link:HTMLAnchorElement|undefined;
  let downloading=false;
  try{
   const until=new Date();
   const response=await fetch(`${ONLINE_ORIGIN}/api/metrics/export`,{headers:{Authorization:`Bearer ${ownerKey.trim()}`},signal:controller.signal,cache:'no-store',credentials:'omit',redirect:'error'});
   if(!response.ok){
    setFailed(true);
    setMessage(response.status===401||response.status===403?'Неверный ключ владельца. Проверьте его и попробуйте снова.':response.status===503?'Выгрузка ещё не настроена владельцем.':response.status===429?'Слишком много запросов. Попробуйте чуть позже.':'Сервер не смог подготовить отчёт. Попробуйте позже.');
    return;
   }
   const report:unknown=await response.json();
   if(!report||typeof report!=='object'||!('matches' in report)||!Array.isArray(report.matches)||!('events' in report)||!Array.isArray(report.events)){
    setFailed(true);
    setMessage('Сервер вернул неполный отчёт. Попробуйте позже.');
    return;
   }
   downloading=true;
   url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json;charset=utf-8'}));
   link=document.createElement('a');
   link.href=url;
   link.download=`contour-playtest-${until.toISOString().slice(0,10)}.json`;
   document.body.appendChild(link);
   link.click();
   setMessage(`Файл передан браузеру. Матчей: ${report.matches.length}, событий: ${report.events.length}.${'truncated' in report&&report.truncated?' Выгружена часть данных: достигнут лимит отчёта.':''}`);
  }catch{
   setFailed(true);
   setMessage(downloading?'Не удалось скачать файл. Попробуйте открыть игру в браузере.':controller.signal.aborted?'Сервер не ответил вовремя. Попробуйте ещё раз.':'Не удалось получить отчёт. Проверьте соединение и попробуйте снова.');
  }finally{
   window.clearTimeout(timeout);
   if(request.current===controller)request.current=null;
   link?.remove();
   if(url){const downloadUrl=url;window.setTimeout(()=>URL.revokeObjectURL(downloadUrl),1000);}
   setBusy(false);
  }
 }

 return <form className="metrics-panel" onSubmit={event=>void downloadReport(event)}>
  <p>Общий отчёт по сетевым матчам за последние 30 дней.</p>
  <div className="metrics-key-field"><label htmlFor={keyId}>Ключ владельца</label><input id={keyId} type="password" value={ownerKey} readOnly={busy} autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={event=>{setOwnerKey(event.target.value);setMessage('');setFailed(false);}}/></div>
  <button type="submit" className="metrics-download" disabled={busy||!ownerKey.trim()}>{busy?<LoaderCircle size={18} className="spin" aria-hidden="true"/>:<Download size={18} aria-hidden="true"/>}{busy?'Готовим отчёт…':'Скачать отчёт'}</button>
  {message&&<p className={`metrics-feedback${failed?' failed':''}`} role={failed?'alert':'status'}>{message}</p>}
 </form>;
}
