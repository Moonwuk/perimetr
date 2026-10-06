'use client';
import {t} from '@/lib/game/translate';

import {Network,ScanLine,Shield,ShieldCheck,KeyRound,Target,Eye,EyeOff,Layers3,Mail,Wrench,RotateCcw,Unplug,LockKeyhole,Server,Zap,TrendingUp} from 'lucide-react';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {CardFace} from './card-face';
import './hand-stacks.css';
import type {useCardDrag} from './use-card-drag';
import {CARDS,cardReadiness,actionStatus,type CardId,type CardKind,type View} from '@/lib/game/engine';
import {groupHandStacks} from '@/lib/game/hand-stacks';
const cardIcons={scan:ScanLine,entry:Unplug,pivot:Network,key:KeyRound,target:Target,shield:Shield,patch:Wrench,eye:Eye,backup:RotateCcw,stealth:EyeOff,cards:Layers3,purge:ShieldCheck,mail:Mail,lock:LockKeyhole,server:Server,trend:TrendingUp,zap:Zap};
export const kindLabels={attack:'Атака',defense:'Защита',economy:'Экономика'};
export function CardIcon({id,size=22}:{id:CardId;size?:number}){const Icon=cardIcons[CARDS[id].icon as keyof typeof cardIcons];return <Icon size={size} strokeWidth={1.7}/>;}
export function Hand({view,selected,busy,onSelect,category,onCategoryChange,onDraw,compact=false,drag,dragged=null}:{view:View;selected:CardId|null;busy:boolean;onSelect:(card:CardId)=>void;category:CardKind|'all';onCategoryChange:(kind:CardKind|'all')=>void;onDraw:()=>void;compact?:boolean;drag?:ReturnType<typeof useCardDrag>;dragged?:CardId|null}){
 const me=view.players[view.viewer],myTurn=view.status==='playing'&&view.turn===view.viewer;
 const stacks=groupHandStacks(me.hand);
 const states=new Map(me.hand.map(c=>[c,cardReadiness(view,c)]));
 const blocked=myTurn&&view.ap>0&&me.hand.length>0&&me.hand.every(c=>!states.get(c)!.ok);
 const categories=['all','attack','defense','economy'] as const;
 return <>
  {t(!compact&&<div className="hand-heading"><h2><Layers3 size={17}/>{t(" Ваша рука ")}<span>{t(me.hand.length)}</span></h2><button disabled={!myTurn||busy||!actionStatus(view,{type:'draw'}).ok} onClick={onDraw}>{t("Добрать ")}<b>1 <Zap size={12}/></b></button><small>{t(me.deckCount)}{t(" в колоде")}</small></div>)}
  {t(!compact&&blocked&&<p className="hand-help">{t((me.exchangeRound??0)!==view.round?'Нет доступных карт. Выберите карту и нажмите «Заменить» или используйте разведку без карты.':'Замена уже использована. Можно разведать поле, обслужить свою сеть или передать ход.')}</p>)}
  <Tabs value={category} onValueChange={kind=>onCategoryChange(kind as CardKind|'all')}>
   <TabsList className="hand-tabs" aria-label={t("Категории карт в руке")}>{t(categories.map(kind=><TabsTrigger key={kind} value={kind}>{t(kind==='all'?'Все':kindLabels[kind])} <b>{t(kind==='all'?me.hand.length:me.hand.filter(c=>CARDS[c].kind===kind).length)}</b></TabsTrigger>))}</TabsList>
   {t(categories.map(kind=><TabsContent key={kind} value={kind}><div className="compact-hand">{t(compact&&<button className="hand-draw" disabled={!myTurn||busy||!actionStatus(view,{type:'draw'}).ok} onClick={onDraw} aria-label={t(`Добрать карту за 1 действие, в колоде ${me.deckCount}`)}><Layers3 size={19}/><span>{t("Добор")}</span><b>1 <Zap size={12}/></b></button>)}{t(stacks.filter(({card})=>kind==='all'||CARDS[card].kind===kind).map(({card:c,count})=>{const def=CARDS[c],state=states.get(c)!;return <button key={c} className={`hand-card comic-hand-card ${def.kind} ${count>1?'has-copies':''} ${selected===c?'selected':''} ${!state.ok?'unavailable':''}`} data-hand-card={c} data-stack-count={count} data-dragging={dragged===c||undefined} onPointerDown={e=>drag?.startPointer(c,e)} onTouchStart={e=>drag?.startTouch(c,e)} onClick={e=>{if(!drag?.consumeClick(e))onSelect(c);}} onDragStart={e=>e.preventDefault()} aria-pressed={selected===c} aria-label={t(`${t(def.name)}: ${def.money} кредитов, ${def.cost} действия. ${t(`Копий в руке: ${count}. Каждый розыгрыш использует одну карту.`)} ${t(def.short)} ${t(state.ok?state.label==='Есть контрмера'?'На найденных целях есть контрмеры. Подробности по кнопке «О карте».':'Перетащите карту сразу на цель или нажмите, чтобы выбрать.':state.reason)}`)}><CardFace id={c} variant="compact" decorative unavailableLabel={!state.ok?state.label:state.label==='Есть контрмера'?'Есть контрмера':undefined}/>{count>1&&<span className="hand-stack-count" aria-hidden="true">×{count}</span>}</button>;}))}{t(!me.hand.some(c=>kind==='all'||CARDS[c].kind===kind)&&<p className="hand-empty">{t(me.hand.length?'Нет карт этой категории. Откройте «Все» и замените любую карту бесплатно.':'Доберите карту или разведайте поле.')}</p>)}</div></TabsContent>))}
  </Tabs>
 </>;
}
