'use client';
import {useRef,useState} from 'react';
import {CircleHelp,Coins,Flag,Info,LoaderCircle,Menu,Network,Play,Radio,ScanLine,Shield,Shuffle,Wifi,X,Zap} from 'lucide-react';
import {GridBoard,actionFor,type Selection} from './board';
import {Hand} from './hand';
import {CardFace} from './card-face';
import type {CardPlayOrigin} from './card-play-effect';
import {useCardDrag,type CardDragPoint as DragPoint} from './use-card-drag';
import {trackMetric} from '@/lib/game/metrics';
import {CARDS,NODES,MAX_ROUNDS,MONEY_GOAL,actionStatus,cardReadiness,coordinate,incomeOf,type Action,type CardId,type CardKind,type Side,type View} from '@/lib/game/engine';

export type TableDetail='card'|'node'|'log'|'finance'|'exchange'|'menu'|'reserve'|'room'|'guide';
type Props={
 view:View;card:CardId|null;selection:Selection|null;side:Side;category:CardKind|'all';busy:boolean;online?:boolean;connection?:string;opponentStatus?:string;
 onCard:(card:CardId)=>void;onCell:(selection:Selection)=>void;onSide:(side:Side)=>void;
 onCategory:(kind:CardKind|'all')=>void;onAction:(action:Action,origin?:CardPlayOrigin)=>void;onEnd:()=>void;
 onDetails:(detail:TableDetail)=>void;onClear:()=>void;
};

type CardDragState={card:CardId;point:DragPoint;startedAt:number;target:Selection|null;globalZone:boolean};
function dropAt(table:HTMLElement|null,id:CardId,point:DragPoint){
 const hit=document.elementFromPoint(point.x,point.y);
 if(!table||!hit||!table.contains(hit))return {target:null,globalZone:false};
 if(CARDS[id].side==='none')return {target:null,globalZone:!!hit.closest('[data-card-dropzone="own"]')};
 const cell=hit.closest<HTMLElement>('[data-game-cell]'),side=cell?.dataset.gameSide,index=Number(cell?.dataset.gameCell);
 return {target:cell&&(side==='own'||side==='enemy')&&Number.isInteger(index)&&index>=0&&index<25?{cell:index,side} as Selection:null,globalZone:false};
}

export function DuelTable({view,card,selection,side,category,busy,online,connection,opponentStatus,onCard,onCell,onSide,onCategory,onAction,onEnd,onDetails,onClear}:Props){
 const me=view.players[view.viewer],enemy=view.players[1-view.viewer],myTurn=view.status==='playing'&&view.turn===view.viewer;
 const tableRef=useRef<HTMLElement>(null),dragRef=useRef<CardDragState|null>(null);
 const [drag,setDrag]=useState<CardDragState|null>(null);
 const cancelDrag=()=>{dragRef.current=null;setDrag(null);};
 const dragControls=useCardDrag({
  enabled:myTurn&&!busy,selected:card,
  resetKey:[view.matchNumber,view.viewer,view.turn,view.round,view.status,category,me.hand.join(',')].join(':'),
  onStart:(id,point)=>{onCard(id);const next={card:id,point,startedAt:performance.now(),target:null,globalZone:false};dragRef.current=next;setDrag(next);},
  onMove:point=>{const current=dragRef.current;if(!current)return;const next={...current,point,...dropAt(tableRef.current,current.card,point)};dragRef.current=next;setDrag(next);},
  onDrop:point=>{
   const current=dragRef.current;cancelDrag();
   if(!current)return;
   const record=(outcome:'submitted'|'cancelled'|'invalid')=>trackMetric('card_drag',{card:current.card,outcome,durationMs:performance.now()-current.startedAt});
   if(card!==current.card||!myTurn||busy||!me.hand.includes(current.card)){record('cancelled');return;}
   const hit=dropAt(tableRef.current,current.card,point);
   if(!hit.target&&!hit.globalZone){record('cancelled');return;}
   const move=actionFor(view,current.card,hit.target);
   // The latest view is authoritative; a stale hover can never authorize a move.
   if(move&&actionStatus(view,move).ok){record('submitted');onAction(move,{x:Math.max(64,Math.min(point.x,window.innerWidth-64)),y:Math.max(6,point.y-168)+74});}else record('invalid');
  },
  onCancel:()=>{const current=dragRef.current;if(current)trackMetric('card_drag',{card:current.card,outcome:'cancelled',durationMs:performance.now()-current.startedAt});cancelDrag();},
 });
 const dragAction=drag&&(drag.target||drag.globalZone)?actionFor(view,drag.card,drag.target):null;
 const dragStatus=dragAction?actionStatus(view,dragAction):null;
 const dragLabel=dragStatus?(dragStatus.ok?'Отпустите — сыграть':dragStatus.reason):drag&&CARDS[drag.card].side==='none'?'Перенесите на панель «Моя сеть»':'Перенесите на подсвеченную цель';
 const fieldSelection=drag?drag.target:selection;
 const action=actionFor(view,card,selection),status=action?actionStatus(view,action):null,readiness=card?cardReadiness(view,card):null;
 const commandStatus=status&&action&&'node' in action&&action.node?status:readiness&&!readiness.ok?readiness:status;
 const selectedPlayer=selection?view.players[selection.side==='own'?view.viewer:1-view.viewer]:null;
 const node=selection&&selectedPlayer?NODES.find(n=>selectedPlayer.layout[n.id]===selection.cell):null;
 const canExchange=!!card&&myTurn&&!busy&&(me.exchangeRound??0)!==view.round&&!!me.exchangeOptions[card]?.length;
 const threats=Object.values(me.nodes).filter(n=>n?.detected).length;
 const summary=commandStatus?(commandStatus.ok?commandStatus.preview:commandStatus.reason):myTurn?(view.ap===0?'Действия закончились. Передайте ход сопернику.':card?'Выберите подсвеченную цель. Деньги спишутся после «Сыграть».':side==='enemy'?'Клетка → «Разведать»: 0 кредитов, 1 действие.':'Нажмите узел: расследование, очистка и ремонт без карт.'):'Можно осмотреть поле и карты. Действия доступны в ваш ход.';
 return <main ref={tableRef} className={`tabletop ${drag?'card-is-dragging':''}`} aria-label="Игровой стол">
  <header className="table-toolbar">
   <button className="table-icon" onClick={()=>onDetails('menu')} aria-label="Меню матча"><Menu size={20}/></button>
   <span className="table-round">Раунд <b>{view.round}</b><small>/{MAX_ROUNDS}</small></span>
   <strong className={myTurn?'your-turn':''}>{view.status==='finished'?'Матч завершён':myTurn?'Ваш ход':'Ход соперника'}</strong>
   <button className="table-icon" onClick={()=>onDetails('guide')} aria-label="Как сделать ход"><CircleHelp size={19}/></button>
   {online?<button className={`table-icon connection-icon ${connection==='Подключено'?'connected':'disconnected'}`} onClick={()=>onDetails('room')} aria-label={`Комната: ${connection}. ${opponentStatus}`}><Wifi size={18}/></button>:<button className="table-icon" onClick={()=>onDetails('log')} aria-label="Журнал матча"><Radio size={18}/></button>}
  </header>

  <section className={`table-company table-enemy ${side==='enemy'?'viewing':''}`} aria-label="Компания соперника">
   <button className="company-switch" aria-pressed={side==='enemy'} onClick={()=>onSide('enemy')} aria-label="Показать поле соперника">
    <span className="company-emblem"><Network size={22}/></span>
    <span className="company-name"><small>СОПЕРНИК{enemy.reserve?' · ДЕЖУРСТВО ?':''}</small><strong>{enemy.name}</strong></span>
   </button>
   <span className="table-money" aria-label={`У соперника ${enemy.money} из ${MONEY_GOAL} кредитов`}><Coins size={15}/><b>{enemy.money}</b><small>/ {MONEY_GOAL}</small></span>
   <span className="company-progress" style={{width:`${Math.min(100,enemy.money/MONEY_GOAL*100)}%`}}/>
  </section>

  <section className={`table-stage ${side==='own'?'own-stage':'enemy-stage'}`} aria-label={side==='own'?'Ваше поле':'Поле соперника'}>
   <div className="table-field-heading">
    <div className="field-switch" role="group" aria-label="Какое поле показать"><button aria-pressed={side==='enemy'} onClick={()=>onSide('enemy')}><ScanLine size={14}/>Соперник</button><button aria-pressed={side==='own'} onClick={()=>onSide('own')}><Shield size={14}/>Моя сеть{threats>0&&<b>{threats}</b>}</button></div>
    {side==='enemy'?<button className={!card?'active':''} onClick={onClear} aria-label="Разведка без карты: 1 действие, 0 кредитов" aria-pressed={!card}>Скан <small>1 <Zap size={11}/></small></button>:<button className={me.reserve?'active':''} onClick={()=>onDetails('reserve')} aria-label="Подготовить секретное дежурство"><Shield size={14}/>{me.reserve?'Готово':'Дежурство'}</button>}
   </div>
   <div className="table-field"><GridBoard view={view} side={side} selected={drag?drag.target:selection} card={card} onSelect={onCell} drop={drag?.target?{selection:drag.target,valid:!!dragStatus?.ok}:null}/></div>
   {card?<p className="table-field-tip">{CARDS[card].name}{CARDS[card].side==='none'?' · без выбора цели':fieldSelection?' · '+coordinate(fieldSelection.cell):' · выберите цель'}</p>:<button className="table-field-tip" onClick={()=>onDetails('guide')}>{side==='own'?'Узел → действия без карт · щит → защита всей сети':'? — скрытая клетка · разведайте, чтобы найти узлы'}</button>}
  </section>

  <section data-card-dropzone="own" className={`table-company table-own ${side==='own'?'viewing':''} ${drag&&CARDS[drag.card].side==='none'?'global-drop-zone':''} ${drag?.globalZone?(dragStatus?.ok?'global-drop-ready':'global-drop-rejected'):''}`} aria-label="Ваша компания">
   <button className="company-switch" aria-pressed={side==='own'} onClick={()=>onSide('own')} aria-label="Показать своё поле">
    <span className="company-emblem"><Shield size={22}/>{threats>0&&<b className="company-threat">{threats}</b>}</span>
    <span className="company-name"><small>ВЫ</small><strong>{drag&&CARDS[drag.card].side==='none'?'Бросьте карту сюда':me.reserve?'Под защитой':'Моя сеть'}</strong></span>
   </button>
   <button className="table-money" onClick={()=>onDetails('finance')} aria-label={`Финансы: ${me.money} из ${MONEY_GOAL} кредитов, доход ${incomeOf(me)}`}><span><Coins size={15}/><b>{me.money}</b></span><small>+{incomeOf(me)} / раунд</small></button>
   <div className={`table-ap ${myTurn?'active':''}`} aria-label={myTurn?`Осталось ${view.ap} из 3 действий`:'Ожидание своего хода'}><span><Zap size={15}/><b>{myTurn?view.ap:0}</b><small>/3</small></span><small>действия</small></div>
   <button className="table-end" disabled={!myTurn||busy} onClick={onEnd} aria-label="Закончить ход"><Flag size={15}/><span>Конец<br/>хода</span></button>
   <span className="company-progress" style={{width:`${Math.min(100,me.money/MONEY_GOAL*100)}%`}}/>
  </section>

  <section className="table-hand" aria-label="Ваша рука">
   <Hand compact view={view} selected={card} busy={busy} onSelect={onCard} category={category} onCategoryChange={onCategory} onDraw={()=>onAction({type:'draw'})} drag={dragControls} dragged={drag?.card}/>
  </section>

  <section className="table-command" aria-label="Выбранное действие" aria-live="polite">
   {card?<div className={`table-selection ${commandStatus&&!commandStatus.ok?'blocked':''}`}>
    <div className="table-card-heading"><strong title={CARDS[card].name}>{CARDS[card].name}</strong><button className="table-card-info" onClick={()=>onDetails('card')} aria-label={`О карте «${CARDS[card].name}»`}><Info size={12}/>О карте</button></div>
    <span>{drag?(dragStatus?.ok?dragStatus.preview:dragLabel):summary}</span>
   </div>:<button className={`table-selection ${commandStatus&&!commandStatus.ok?'blocked':''}`} onClick={()=>onDetails(node?'node':'guide')} aria-label={node?'Подробнее об узле':'Как выбрать действие'}>
    <strong>{selection?`${coordinate(selection.cell)} · ${node?.name??'Разведка'}`:'Выберите карту · затем цель'}<Info size={14}/></strong>
    <span>{drag?(dragStatus?.ok?dragStatus.preview:dragLabel):summary}</span>
   </button>}
   {card&&<button className="table-icon table-exchange" disabled={!canExchange} onClick={()=>onDetails('exchange')} aria-label={(me.exchangeRound??0)===view.round?'Замена уже использована':'Бесплатно заменить карту'} title="Бесплатно заменить карту"><Shuffle size={18}/><small>{(me.exchangeRound??0)===view.round?'0/1':'1/1'}</small></button>}
   {(card||selection)&&<button className="table-icon table-clear" aria-label="Отменить выбор" onClick={onClear}><X size={18}/></button>}
   {action&&<button className="table-play" disabled={!!drag||!myTurn||busy||!status?.ok} onClick={()=>onAction(action)} aria-label={card?`Сыграть «${CARDS[card].name}» за ${CARDS[card].money} кредитов и ${CARDS[card].cost} ${CARDS[card].cost===1?'действие':'действия'}`:'Разведать за 1 действие'}>{busy?<LoaderCircle className="spin" size={16}/>:!card&&<Play size={15}/>}<span>{busy?'Ход…':card?'Сыграть':'Разведать'}{card&&!busy&&<small>{CARDS[card].money} ¤ · {CARDS[card].cost} ОД</small>}</span></button>}
  </section>
  {drag&&<div className={`card-drag-layer ${dragStatus?.ok?'can-drop':''}`} aria-hidden="true">
   <div className="card-drag-ghost" style={{left:Math.max(64,Math.min(drag.point.x,window.innerWidth-64)),top:Math.max(6,drag.point.y-168)}}><CardFace id={drag.card} variant="compact" decorative/></div>
   <span className="card-drag-aim" style={{left:drag.point.x,top:drag.point.y}}/>
   <div className="card-drag-hint"><strong>{dragLabel}</strong><span>{CARDS[drag.card].money} ¤ · {CARDS[drag.card].cost} ОД · вне цели — отмена</span></div>
  </div>}
 </main>;
}
