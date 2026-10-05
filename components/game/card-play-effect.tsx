'use client';

import {useCallback,useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {Check,Coins,ScanLine,Shield,Zap} from 'lucide-react';
import {CARDS,incomeOf,type Action,type CardId,type CardKind,type Side,type View} from '@/lib/game/engine';
import {CardFace} from './card-face';
import './card-play-effect.css';

type Point={x:number;y:number};
/** The held card's centre, captured before its drag ghost is removed. */
export type CardPlayOrigin=Point;
type CardAction=Extract<Action,{type:'card'}>;
type Target={side:Side;cell?:number};
type PreparedPlay={action:CardAction;before:View;source:Point;target:Target;generation:number;resetKey:string};
type PlayEffect={id:number;card:CardId;kind:CardKind;source:Point;target:Point;targetSize:number;label:string;blocked:boolean;resetKey:string;generation:number};
const EFFECT_MS=780;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(n,max));
function centre(element:Element|null):Point|null{
 if(!element)return null;
 const rect=element.getBoundingClientRect();
 return rect.width&&rect.height?{x:clamp(rect.left+rect.width/2,16,window.innerWidth-16),y:clamp(rect.top+rect.height/2,16,window.innerHeight-16)}:null;
}
function targetElement(target:Target){
 return (target.cell===undefined?null:document.querySelector(`[data-game-side="${target.side}"][data-game-cell="${target.cell}"]`))??document.querySelector(`.table-${target.side==='own'?'own':'enemy'} .company-emblem`);
}
function resultOf(action:CardAction,before:View,after:View){
 const id=action.card,me=after.players[before.viewer],oldMe=before.players[before.viewer];
 const freshLogs=after.logs.filter(log=>log.id>before.serial);
 const blocked=CARDS[id].kind==='attack'&&freshLogs.some(log=>log.tone==='defense'&&/ отразил[ао]? /.test(log.text));
 if(blocked)return {blocked,label:'Отражено защитой'};
 const lost=before.players[1-before.viewer].money-after.players[1-before.viewer].money;
 if(['ddos','operation','fraud'].includes(id)&&lost>0)return {blocked,label:id==='fraud'?`Украдено ${lost} ¤`:`Сопернику −${lost} ¤`};
 if(id==='recon')return {blocked,label:`Разведано: +${me.scanned.length-oldMe.scanned.length} клеток`};
 if(id==='expand'||id==='optimize')return {blocked,label:`+${incomeOf(me)-incomeOf(oldMe)} дохода / раунд`};
 if(id==='supply')return {blocked,label:`Получено карт: ${Math.max(0,me.hand.length-oldMe.hand.length+1)}`};
 const labels:Partial<Record<CardId,string>>={entry:'Доступ получен',pivot:'Доступ получен',escalate:'Права повышены',phishing:'Доступ получен',shield:'+1 защита от DDoS',patch:'Защита обновлена',sensor:'Датчик установлен',backup:'Восстановлено и защищено',purge:'Проверено и очищено',segment:'Узел изолирован',stealth:'Тихий проход готов',ddos:'Сервис отключён',operation:'Сервис отключён',fraud:'Платёж перехвачен'};
 return {blocked,label:labels[id]??'Карта применена'};
}

/** Geometry is captured before the hand changes; only an acknowledged action may confirm it. */
export function useCardPlayEffect(resetKey:string){
 const [effect,setEffect]=useState<PlayEffect|null>(null);
 if(effect&&effect.resetKey!==resetKey)setEffect(null);
 const liveKey=useRef(resetKey),generation=useRef(0),serial=useRef(0);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const invalidate=useCallback(()=>{generation.current++;if(timer.current!==null)clearTimeout(timer.current);timer.current=null;},[]);
 const clear=useCallback(()=>{invalidate();setEffect(null);},[invalidate]);
 useLayoutEffect(()=>{liveKey.current=resetKey;invalidate();},[resetKey,invalidate]);
 useLayoutEffect(()=>{
  const visibility=()=>{if(document.hidden)clear();};
  window.addEventListener('resize',clear);
  window.addEventListener('blur',clear);
  document.addEventListener('visibilitychange',visibility);
  return()=>{invalidate();window.removeEventListener('resize',clear);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',visibility);};
 },[clear,invalidate]);
 const prepare=(action:Action,view:View|null,origin?:CardPlayOrigin):PreparedPlay|null=>{
  if(action.type!=='card'||!view||document.hidden||!document.querySelector('.tabletop'))return null;
  const side=CARDS[action.card].side==='enemy'?'enemy':'own';
  const player=view.players[side==='own'?view.viewer:1-view.viewer];
  const cell=action.cell??(action.node?player.layout[action.node]:undefined);
  const cardElement=document.querySelector(`[data-hand-card="${action.card}"][aria-pressed="true"]`)??document.querySelector(`[data-hand-card="${action.card}"]`);
  const source=origin??centre(cardElement)??centre(document.querySelector('.table-hand'));
  if(!source)return null;
  return {action,before:view,source,target:{side,cell},generation:generation.current,resetKey:liveKey.current};
 };
 const confirm=(prepared:PreparedPlay|null,after:View)=>{
  if(!prepared||prepared.generation!==generation.current||prepared.resetKey!==liveKey.current||document.hidden||after.viewer!==prepared.before.viewer||after.matchNumber!==prepared.before.matchNumber)return;
  const element=targetElement(prepared.target),target=centre(element);
  if(!target)return;
  const rect=element!.getBoundingClientRect(),result=resultOf(prepared.action,prepared.before,after);
  if(timer.current!==null)clearTimeout(timer.current);
  setEffect({id:++serial.current,card:prepared.action.card,kind:CARDS[prepared.action.card].kind,source:prepared.source,target,targetSize:clamp(Math.max(rect.width,rect.height)+14,48,100),...result,resetKey:prepared.resetKey,generation:prepared.generation});
  timer.current=setTimeout(()=>{timer.current=null;setEffect(null);},EFFECT_MS);
 };
 return {prepare,confirm,clear,effect:effect?.resetKey===resetKey?effect:null};
}

export function CardPlayEffect({effect}:{effect:PlayEffect|null}){
 if(!effect)return null;
 const {source,target}=effect,mid={x:source.x+(target.x-source.x)*.55,y:source.y+(target.y-source.y)*.55-26};
 const style={
  '--play-from-x':`${source.x}px`,'--play-from-y':`${source.y}px`,'--play-mid-x':`${mid.x}px`,'--play-mid-y':`${mid.y}px`,
  '--play-to-x':`${target.x}px`,'--play-to-y':`${target.y}px`,'--play-target-size':`${effect.targetSize}px`,
  '--play-label-x':`${clamp(target.x,122,window.innerWidth-122)}px`,'--play-label-y':`${clamp(target.y-effect.targetSize/2-31,48,window.innerHeight-60)}px`,
 } as CSSProperties;
 const Icon=effect.blocked?Shield:effect.card==='recon'?ScanLine:effect.kind==='attack'?Zap:effect.kind==='defense'?Shield:Coins;
 return createPortal(<div key={effect.id} className={`card-play-effect ${effect.kind} ${effect.blocked?'blocked':''}`} style={style} data-card-play-effect={effect.card} data-card-play-kind={effect.kind} data-card-play-result={effect.blocked?'blocked':'applied'} aria-hidden="true">
  <svg className="card-play-trail" width="100%" height="100%"><path d={`M ${source.x} ${source.y} Q ${mid.x} ${mid.y} ${target.x} ${target.y}`} pathLength="1"/></svg>
  <div className="card-play-flight"><CardFace id={effect.card} variant="compact" decorative/></div>
  <div className="card-play-impact"><span className="card-play-ring"/><span className="card-play-spark one"/><span className="card-play-spark two"/><span className="card-play-spark three"/><span className="card-play-spark four"/><Icon className="card-play-symbol" size={29}/></div>
  <div className="card-play-result"><span><Check size={11}/>{CARDS[effect.card].name}</span><strong>{effect.label}</strong></div>
 </div>,document.body);
}
