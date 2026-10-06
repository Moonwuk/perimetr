'use client';
import {t} from '@/lib/game/translate';

import {useRef,useState,type ReactNode} from 'react';
import {CircleHelp,Coins,Flag,Info,LoaderCircle,Menu,Network,Pause,Play,Radio,ScanLine,Shield,Shuffle,Wifi,X,Zap} from 'lucide-react';
import {GridBoard,actionFor,type Selection} from './board';
import {Hand} from './hand';
import {NodeActions} from './node-actions';
import {CardFace} from './card-face';
import type {CardPlayOrigin} from './card-play-effect';
import {useCardDrag,type CardDragPoint as DragPoint} from './use-card-drag';
import {trackMetric} from '@/lib/game/metrics';
import {CARDS,NODES,MAX_ROUNDS,MONEY_GOAL,actionStatus,cardReadiness,coordinate,incomeOf,type Action,type CardId,type CardKind,type Side,type View} from '@/lib/game/engine';

export type TableDetail='card'|'node'|'log'|'finance'|'exchange'|'menu'|'reserve'|'room'|'guide';
type Props={
 view:View;card:CardId|null;selection:Selection|null;side:Side;category:CardKind|'all';busy:boolean;online?:boolean;connection?:string;opponentStatus?:string;
 feedback?:ReactNode;hasFeedback?:boolean;recovery?:ReactNode;
 onCard:(card:CardId)=>void;onCell:(selection:Selection)=>void;onSide:(side:Side)=>void;
 onCategory:(kind:CardKind|'all')=>void;onAction:(action:Action,origin?:CardPlayOrigin)=>void;onEnd:()=>void;
 onDetails:(detail:TableDetail)=>void;onClear:()=>void;onPause?:()=>void;
};

type CardDragState={card:CardId;point:DragPoint;startedAt:number;target:Selection|null;globalZone:boolean};
function dropAt(table:HTMLElement|null,id:CardId,point:DragPoint){
 const hit=document.elementFromPoint(point.x,point.y);
 if(!table||!hit||!table.contains(hit))return {target:null,globalZone:false};
 if(CARDS[id].side==='none')return {target:null,globalZone:!!hit.closest('[data-card-dropzone="own"]')};
 const cell=hit.closest<HTMLElement>('[data-game-cell]'),side=cell?.dataset.gameSide,index=Number(cell?.dataset.gameCell);
 return {target:cell&&(side==='own'||side==='enemy')&&Number.isInteger(index)&&index>=0&&index<25?{cell:index,side} as Selection:null,globalZone:false};
}

export function DuelTable({view,card,selection,side,category,busy,online,connection,opponentStatus,feedback,hasFeedback,recovery,onCard,onCell,onSide,onCategory,onAction,onEnd,onDetails,onClear,onPause}:Props){
 const me=view.players[view.viewer],enemy=view.players[1-view.viewer],myTurn=view.status==='playing'&&view.turn===view.viewer&&!view.pause?.pausedAt;
 const tableRef=useRef<HTMLElement>(null),dragRef=useRef<CardDragState|null>(null);
 const [drag,setDrag]=useState<CardDragState|null>(null);
 const cancelDrag=()=>{dragRef.current=null;setDrag(null);};
 const dragControls=useCardDrag({
  enabled:myTurn&&!busy,selected:card,
  resetKey:[view.matchNumber,view.viewer,view.turn,view.round,view.status,view.pause?.pausedAt,category,me.hand.join(',')].join(':'),
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
 return <main ref={tableRef} className={`tabletop ${!card&&node&&selection?.side==='own'?'has-node-actions':''} ${drag?'card-is-dragging':''}`} aria-label={t("Игровой стол")}>
  <header className="table-toolbar"><span className="table-brand"><Network size={26}/>{t("КОНТУР")}</span>
   <button className="table-icon" onClick={()=>onDetails('menu')} aria-label={t("Меню матча")}><Menu size={20}/></button>
   <strong className={myTurn?'your-turn':''}>{t(view.status==='finished'?'Матч завершён':view.pause?.pausedAt?'Пауза':myTurn?'Ваш ход':'Ход соперника')}</strong>
   {t(online&&<button className="table-pause" onClick={onPause??(()=>onDetails('room'))} disabled={busy||!!view.pause}><Pause size={16}/><span>{t("Пауза")}</span></button>)}
   {t(online&&<button className={`table-icon connection-icon ${connection==='Подключено'?'connected':'disconnected'}`} onClick={()=>onDetails('room')} aria-label={t(`Комната: ${connection}. ${opponentStatus}`)}><Wifi size={18}/></button>)}
  </header>

  <section className={`table-company table-enemy ${side==='enemy'?'viewing':''}`} aria-label={t("Компания соперника")}>
   <button className="company-switch" aria-pressed={side==='enemy'} onClick={()=>onSide('enemy')} aria-label={t("Показать поле соперника")}>
    <span className="company-emblem"><Network size={22}/></span>
    <span className="company-name"><small>{t("СОПЕРНИК")}<span className="mobile-reserve-hint">{t(enemy.reserve?' · ДЕЖУРСТВО ?':'')}</span></small><span className="opponent-round">{t("Раунд ")}<b>{t(view.round)}</b><small>/{t(MAX_ROUNDS)}</small></span><strong>{enemy.name}</strong></span>
   </button>
   <span className="table-money" aria-label={t(`У соперника ${enemy.money} из ${MONEY_GOAL} кредитов`)}><Coins size={15}/><b>{t(enemy.money)}</b><small>/ {t(MONEY_GOAL)}</small></span>
   <span className="company-progress" style={{width:`${Math.min(100,enemy.money/MONEY_GOAL*100)}%`}}/><div className="desktop-opponent-state"><p>{t((online?opponentStatus:null)||(myTurn?'Ожидает вашего хода':'Ход соперника'))}</p>{t(enemy.reserve&&<p><Shield size={16}/>{t("Дежурство подготовлено ")}<CircleHelp size={16}/></p>)}</div>
  </section>

  <section className={`table-stage ${side==='own'?'own-stage':'enemy-stage'} ${card?'has-target-hint':''}`} aria-label={t(side==='own'?'Ваше поле':'Поле соперника')}>
   <div className="table-field-heading">
    <div className="field-switch" role="group" aria-label={t("Какое поле показать")}><button aria-pressed={side==='enemy'} onClick={()=>onSide('enemy')}><ScanLine size={14}/>{t("Соперник")}</button><button aria-pressed={side==='own'} onClick={()=>onSide('own')}><Shield size={14}/>{t("Моя сеть")}{t(threats>0&&<b>{t(threats)}</b>)}</button></div>
    {t(side==='enemy'?<button className={!card?'active':''} onClick={onClear} aria-label={t("Разведка без карты: 1 действие, 0 кредитов")} aria-pressed={!card}>{t("Скан ")}<small>1 <Zap size={11}/></small></button>:<div className="reserve-tools"><button className={me.reserve?'active':''} onClick={()=>onDetails('reserve')} aria-label={t("Подготовить секретное дежурство")}><Shield size={14}/><span>{t(me.reserve?'Готово':'Дежурство')}</span></button><div className="reserve-quick-actions"><button onClick={()=>onDetails('guide')} aria-label={t("Как сделать ход")}><CircleHelp size={13}/></button><button onClick={()=>onDetails('log')} aria-label={t("Журнал матча")}><Radio size={13}/></button></div></div>)}
   </div>
   <div className="table-recovery">{t(recovery)}</div>
   <div className="table-boards">{t((['own','enemy'] as const).map(boardSide=><section key={boardSide} className={`table-board-panel board-${boardSide} ${side===boardSide?'active-board':''}`} aria-label={t(boardSide==='own'?'Ваша сеть':'Сеть соперника')}>
    <div className="desktop-board-heading"><span>{t(boardSide==='own'?<Shield size={21}/>:<Network size={21}/>)} {t(boardSide==='own'?'Ваша сеть':'Сеть соперника')}</span>{t(boardSide==='own'?<div className="desktop-reserve-tools"><button className="desktop-reserve-main" onClick={()=>onDetails('reserve')}><Shield size={14}/>{t(me.reserve?'Дежурство готово':'Дежурство')}</button><div className="desktop-reserve-quick"><button onClick={()=>onDetails('guide')} aria-label={t("Как сделать ход")}><CircleHelp size={13}/></button><button onClick={()=>onDetails('log')} aria-label={t("Журнал матча")}><Radio size={13}/></button></div></div>:<button onClick={()=>{onClear();onSide('enemy');}}><ScanLine size={14}/>{t("Разведка")}</button>)}</div>
    <div className="table-field"><GridBoard view={view} side={boardSide} selected={fieldSelection} card={card} onSelect={onCell} drop={drag?.target?{selection:drag.target,valid:!!dragStatus?.ok}:null}/></div>
   </section>))}</div>
   <p className="table-field-tip">{t(card?`${CARDS[card].name} · ${CARDS[card].side==='none'?'без выбора цели':fieldSelection?coordinate(fieldSelection.cell):'выберите цель'}`:node&&selection?`${selection.side==='own'?'Выбран ваш узел':'Выбрана цель'} · ${coordinate(selection.cell)}`:'Выберите карту или узел')}</p>
  </section>

  <section data-card-dropzone="own" className={`table-company table-own ${side==='own'?'viewing':''} ${drag&&CARDS[drag.card].side==='none'?'global-drop-zone':''} ${drag?.globalZone?(dragStatus?.ok?'global-drop-ready':'global-drop-rejected'):''}`} aria-label={t("Ваша компания")}>
   <button className="company-switch" aria-pressed={side==='own'} onClick={()=>onSide('own')} aria-label={t("Показать своё поле")}>
    <span className="company-emblem"><Shield size={22}/>{t(threats>0&&<b className="company-threat">{t(threats)}</b>)}</span>
    <span className="company-name"><small>{t("ВЫ")}</small><strong>{t(drag&&CARDS[drag.card].side==='none'?'Бросьте карту сюда':me.reserve?'Под защитой':'Моя сеть')}</strong></span>
   </button>
   <button className="table-money" onClick={()=>onDetails('finance')} aria-label={t(`Финансы: ${me.money} из ${MONEY_GOAL} кредитов, доход ${incomeOf(me)}`)}><span><Coins size={15}/><b>{t(me.money)}</b><small className="desktop-money-goal">/ {MONEY_GOAL}</small></span><small>+{t(incomeOf(me))}{t(" / раунд")}</small></button>
   <div className={`table-ap ${myTurn?'active':''}`} aria-label={t(myTurn?`Осталось ${view.ap} из 3 действий`:'Ожидание своего хода')}><span><Zap size={15}/><b>{t(myTurn?view.ap:0)}</b><small>/3</small></span><small>{t("действия")}</small></div>

   <span className="company-progress" style={{width:`${Math.min(100,me.money/MONEY_GOAL*100)}%`}}/>
  </section>

  <section className="table-hand" aria-label={t("Ваша рука")}>
   <Hand compact view={view} selected={card} busy={busy} onSelect={onCard} category={category} onCategoryChange={onCategory} onDraw={()=>onAction({type:'draw'})} drag={dragControls} dragged={drag?.card}/>
  </section>

  <section className="table-command" aria-label={t("Выбранное действие")} aria-live="polite">
   {t(!card&&node&&selection?.side==='own'?<NodeActions view={view} node={node.id} coordinate={coordinate(selection.cell)} busy={busy} onAction={onAction} onClear={onClear} onDetails={()=>onDetails('node')}/>:<>
   {t(card?<div className={`table-selection ${commandStatus&&!commandStatus.ok?'blocked':''}`}>
    <div className="table-card-heading"><strong title={t(CARDS[card].name)}>{t(CARDS[card].name)}</strong><button className="table-card-info" onClick={()=>onDetails('card')} aria-label={t(`О карте «${CARDS[card].name}»`)}><Info size={12}/>{t("О карте")}</button></div>
    <span>{t(drag?(dragStatus?.ok?dragStatus.preview:dragLabel):summary)}</span>
   </div>:!selection&&hasFeedback?feedback:<button className={`table-selection ${commandStatus&&!commandStatus.ok?'blocked':''}`} onClick={()=>onDetails(node?'node':'guide')} aria-label={t(node?'Подробнее об узле':'Как выбрать действие')}>
    <strong>{t(selection?`${coordinate(selection.cell)} · ${node?.name??'Разведка'}`:'Выберите карту · затем цель')}<Info size={14}/></strong>
    <span>{t(drag?(dragStatus?.ok?dragStatus.preview:dragLabel):summary)}</span>
   </button>)}
   {t(card&&<button className="table-icon table-exchange" disabled={!canExchange} onClick={()=>onDetails('exchange')} aria-label={t((me.exchangeRound??0)===view.round?'Замена уже использована':'Бесплатно заменить карту')} title={t("Бесплатно заменить карту")}><Shuffle size={18}/><small>{t((me.exchangeRound??0)===view.round?'0/1':'1/1')}</small></button>)}
   {t((card||selection)&&<button className="table-icon table-clear" aria-label={t("Отменить выбор")} onClick={onClear}><X size={18}/></button>)}
   {t(action&&<button className="table-play" disabled={!!drag||!myTurn||busy||!status?.ok} onClick={()=>onAction(action)} aria-label={t(card?`Сыграть «${CARDS[card].name}» за ${CARDS[card].money} кредитов и ${CARDS[card].cost} ${CARDS[card].cost===1?'действие':'действия'}`:'Разведать за 1 действие')}>{t(busy?<LoaderCircle className="spin" size={16}/>:!card&&<Play size={15}/>)}<span>{t(busy?'Ход…':card?'Сыграть':'Разведать')}{t(card&&!busy&&<small>{t(CARDS[card].money)} ¤ · {t(CARDS[card].cost)}{t(" ОД")}</small>)}</span></button>)}
   </>)}
  </section>
  <div className="table-end-controls">{t(card&&<button className="table-details" onClick={()=>onDetails('card')}><Info size={17}/><span>{t("О карте")}</span></button>)}<button className="table-end" disabled={!myTurn||busy} onClick={onEnd} aria-label={t("Закончить ход")}><Flag size={18}/><span>{t("Конец хода")}</span></button></div>
  {t(drag&&<div className={`card-drag-layer ${dragStatus?.ok?'can-drop':''}`} aria-hidden="true">
   <div className="card-drag-ghost" style={{left:Math.max(64,Math.min(drag.point.x,window.innerWidth-64)),top:Math.max(6,drag.point.y-168)}}><CardFace id={drag.card} variant="compact" decorative/></div>
   <span className="card-drag-aim" style={{left:drag.point.x,top:drag.point.y}}/>
   <div className="card-drag-hint"><strong>{t(dragLabel)}</strong><span>{t(CARDS[drag.card].money)} ¤ · {t(CARDS[drag.card].cost)}{t(" ОД · вне цели — отмена")}</span></div>
  </div>)}
 </main>;
}
