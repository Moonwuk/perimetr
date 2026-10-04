'use client';
import {CircleHelp,Coins,Flag,Info,LoaderCircle,Menu,Network,Play,Radio,ScanLine,Shield,Shuffle,Wifi,X,Zap} from 'lucide-react';
import {GridBoard,actionFor,type Selection} from './board';
import {Hand} from './hand';
import {CARDS,NODES,MAX_ROUNDS,MONEY_GOAL,actionStatus,cardReadiness,coordinate,incomeOf,type Action,type CardId,type CardKind,type Side,type View} from '@/lib/game/engine';

export type TableDetail='card'|'node'|'log'|'finance'|'exchange'|'menu'|'reserve'|'room'|'guide';
type Props={
 view:View;card:CardId|null;selection:Selection|null;side:Side;category:CardKind|'all';busy:boolean;online?:boolean;connection?:string;opponentStatus?:string;
 onCard:(card:CardId)=>void;onCell:(selection:Selection)=>void;onSide:(side:Side)=>void;
 onCategory:(kind:CardKind|'all')=>void;onAction:(action:Action)=>void;onEnd:()=>void;
 onDetails:(detail:TableDetail)=>void;onClear:()=>void;
};

export function DuelTable({view,card,selection,side,category,busy,online,connection,opponentStatus,onCard,onCell,onSide,onCategory,onAction,onEnd,onDetails,onClear}:Props){
 const me=view.players[view.viewer],enemy=view.players[1-view.viewer],myTurn=view.status==='playing'&&view.turn===view.viewer;
 const action=actionFor(view,card,selection),status=action?actionStatus(view,action):null,readiness=card?cardReadiness(view,card):null;
 const commandStatus=status&&action&&'node' in action&&action.node?status:readiness&&!readiness.ok?readiness:status;
 const selectedPlayer=selection?view.players[selection.side==='own'?view.viewer:1-view.viewer]:null;
 const node=selection&&selectedPlayer?NODES.find(n=>selectedPlayer.layout[n.id]===selection.cell):null;
 const canExchange=!!card&&myTurn&&!busy&&(me.exchangeRound??0)!==view.round&&!!me.exchangeOptions[card]?.length;
 const threats=Object.values(me.nodes).filter(n=>n?.detected).length;
 const summary=commandStatus?(commandStatus.ok?commandStatus.preview:commandStatus.reason):myTurn?(view.ap===0?'Действия закончились. Передайте ход сопернику.':card?'Выберите подсвеченную цель. Деньги спишутся после «Сыграть».':side==='enemy'?'Клетка → «Разведать»: 0 кредитов, 1 действие.':'Нажмите узел: расследование, очистка и ремонт без карт.'):'Можно осмотреть поле и карты. Действия доступны в ваш ход.';
 return <main className="tabletop" aria-label="Игровой стол">
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
   <div className="table-field"><GridBoard view={view} side={side} selected={selection} card={card} onSelect={onCell}/></div>
   <button className="table-field-tip" onClick={()=>onDetails(card?'card':'guide')}>{card?`${CARDS[card].name}${selection?' · '+coordinate(selection.cell):' · выберите цель'}`:side==='own'?'Узел → действия без карт · щит → защита всей сети':'? — скрытая клетка · разведайте, чтобы найти узлы'}</button>
  </section>

  <section className={`table-company table-own ${side==='own'?'viewing':''}`} aria-label="Ваша компания">
   <button className="company-switch" aria-pressed={side==='own'} onClick={()=>onSide('own')} aria-label="Показать своё поле">
    <span className="company-emblem"><Shield size={22}/>{threats>0&&<b className="company-threat">{threats}</b>}</span>
    <span className="company-name"><small>ВЫ</small><strong>{me.reserve?'Под защитой':'Моя сеть'}</strong></span>
   </button>
   <button className="table-money" onClick={()=>onDetails('finance')} aria-label={`Финансы: ${me.money} из ${MONEY_GOAL} кредитов, доход ${incomeOf(me)}`}><span><Coins size={15}/><b>{me.money}</b></span><small>+{incomeOf(me)} / раунд</small></button>
   <div className={`table-ap ${myTurn?'active':''}`} aria-label={myTurn?`Осталось ${view.ap} из 3 действий`:'Ожидание своего хода'}><span><Zap size={15}/><b>{myTurn?view.ap:0}</b><small>/3</small></span><small>действия</small></div>
   <button className="table-end" disabled={!myTurn||busy} onClick={onEnd} aria-label="Закончить ход"><Flag size={15}/><span>Конец<br/>хода</span></button>
   <span className="company-progress" style={{width:`${Math.min(100,me.money/MONEY_GOAL*100)}%`}}/>
  </section>

  <section className="table-hand" aria-label="Ваша рука">
   <Hand compact view={view} selected={card} busy={busy} onSelect={onCard} category={category} onCategoryChange={onCategory} onDraw={()=>onAction({type:'draw'})}/>
  </section>

  <section className="table-command" aria-label="Выбранное действие" aria-live="polite">
   <button className={`table-selection ${commandStatus&&!commandStatus.ok?'blocked':''}`} onClick={()=>onDetails(card?'card':node?'node':'guide')} aria-label={card?'Описание выбранной карты':node?'Подробнее об узле':'Как выбрать действие'}>
    <strong>{card?CARDS[card].name:selection?`${coordinate(selection.cell)} · ${node?.name??'Разведка'}`:'Карта по нажатию · листайте руку'}<Info size={14}/></strong>
    <span>{summary}</span>
   </button>
   {card&&<button className="table-icon table-exchange" disabled={!canExchange} onClick={()=>onDetails('exchange')} aria-label={(me.exchangeRound??0)===view.round?'Замена уже использована':'Бесплатно заменить карту'} title="Бесплатно заменить карту"><Shuffle size={18}/><small>{(me.exchangeRound??0)===view.round?'0/1':'1/1'}</small></button>}
   {(card||selection)&&<button className="table-icon table-clear" aria-label="Отменить выбор" onClick={onClear}><X size={18}/></button>}
   {action&&<button className="table-play" disabled={!myTurn||busy||!status?.ok} onClick={()=>onAction(action)}>{busy?<LoaderCircle className="spin" size={16}/>:<Play size={15}/>}<span>{card?'Сыграть':'Разведать'}</span></button>}
  </section>
 </main>;
}
