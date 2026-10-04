'use client';
import {Coins,Flag,Info,LoaderCircle,Menu,Network,Play,Radio,ScanLine,Shield,Shuffle,Wifi,X,Zap} from 'lucide-react';
import {GridBoard,actionFor,type Selection} from './board';
import {Hand} from './hand';
import {CARDS,NODES,MAX_ROUNDS,MONEY_GOAL,actionStatus,cardReadiness,coordinate,incomeOf,COUNTER_LABELS,type Action,type CardId,type CardKind,type Side,type View} from '@/lib/game/engine';

export type TableDetail='card'|'node'|'log'|'finance'|'exchange'|'menu'|'reserve'|'room';
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
 const summary=commandStatus?(commandStatus.ok?commandStatus.preview:commandStatus.reason):myTurn?(card?'Выберите подсвеченную цель.':side==='enemy'?'Нажмите клетку для разведки.':'Нажмите узел для защиты и ремонта.'):'Можно осмотреть поле и карты.';
 return <main className="tabletop" aria-label="Игровой стол">
  <header className="table-toolbar">
   <button className="table-icon" onClick={()=>onDetails('menu')} aria-label="Меню матча"><Menu size={20}/></button>
   <span className="table-round">Раунд <b>{view.round}</b><small>/{MAX_ROUNDS}</small></span>
   <strong className={myTurn?'your-turn':''}>{view.status==='finished'?'Матч завершён':myTurn?'Ваш ход':'Ход соперника'}</strong>
   {online?<button className={`table-icon connection-icon ${connection==='Подключено'?'connected':'disconnected'}`} onClick={()=>onDetails('room')} aria-label={`Комната: ${connection}. ${opponentStatus}`}><Wifi size={18}/></button>:<button className="table-icon" onClick={()=>onDetails('log')} aria-label="Журнал матча"><Radio size={18}/></button>}
  </header>

  <section className={`table-company table-enemy ${side==='enemy'?'viewing':''}`} aria-label="Компания соперника">
   <button className="company-switch" aria-pressed={side==='enemy'} onClick={()=>onSide('enemy')} aria-label="Показать поле соперника">
    <span className="company-emblem"><Network size={22}/></span>
    <span className="company-name"><small>СОПЕРНИК</small><strong>{enemy.name}</strong></span>
    <span className="company-map-label">{enemy.reserve?'Секрет ?':'Поле'} <ScanLine size={15}/></span>
   </button>
   <span className="table-money" aria-label={`У соперника ${enemy.money} кредитов`}><Coins size={15}/><b>{enemy.money}</b></span>
   <span className="company-progress" style={{width:`${Math.min(100,enemy.money/MONEY_GOAL*100)}%`}}/>
  </section>

  <section className={`table-stage ${side==='own'?'own-stage':'enemy-stage'}`} aria-label={side==='own'?'Ваше поле':'Поле соперника'}>
   <div className="table-field-heading"><span>{side==='own'?<Shield size={15}/>:<ScanLine size={15}/>} {side==='own'?'Ваша сеть':'Сеть соперника'}</span>
    {side==='enemy'?<button className={!card?'active':''} onClick={onClear} aria-label="Разведка без карты: 1 действие, 0 кредитов" aria-pressed={!card}>Разведка <small>1 <Zap size={11}/></small></button>:<button className={me.reserve?'active':''} onClick={()=>onDetails('reserve')} aria-label="Подготовить секретное дежурство"><Shield size={14}/>{me.reserve&&me.reserve!=='hidden'?COUNTER_LABELS[me.reserve]:'Дежурство'}</button>}
   </div>
   <div className="table-field"><GridBoard view={view} side={side} selected={selection} card={card} onSelect={onCell}/></div>
  </section>

  <section className={`table-company table-own ${side==='own'?'viewing':''}`} aria-label="Ваша компания">
   <button className="company-switch" aria-pressed={side==='own'} onClick={()=>onSide('own')} aria-label="Показать своё поле">
    <span className="company-emblem"><Shield size={22}/>{threats>0&&<b className="company-threat">{threats}</b>}</span>
    <span className="company-name"><small>ВЫ</small><strong>{me.reserve?'Дежурство готово':'Моя сеть'}</strong></span>
   </button>
   <button className="table-money" onClick={()=>onDetails('finance')} aria-label={`Финансы: ${me.money} кредитов, доход ${incomeOf(me)}`}><span><Coins size={15}/><b>{me.money}</b></span><small>+{incomeOf(me)} / раунд</small></button>
   <div className={`table-ap ${myTurn?'active':''}`} aria-label={myTurn?`Осталось ${view.ap} из 3 действий`:'Ожидание своего хода'}>{[1,2,3].map(n=><Zap key={n} size={15} className={myTurn&&n<=view.ap?'charged':''}/>)}</div>
   <button className="table-end" disabled={!myTurn||busy} onClick={onEnd} aria-label="Закончить ход"><Flag size={16}/><span>Ход</span></button>
   <span className="company-progress" style={{width:`${Math.min(100,me.money/MONEY_GOAL*100)}%`}}/>
  </section>

  <section className="table-hand" aria-label="Ваша рука">
   <Hand compact view={view} selected={card} busy={busy} onSelect={onCard} category={category} onCategoryChange={onCategory} onDraw={()=>onAction({type:'draw'})}/>
  </section>

  <section className="table-command" aria-label="Выбранное действие">
   <button className={`table-selection ${commandStatus&&!commandStatus.ok?'blocked':''}`} disabled={!card&&!node} onClick={()=>onDetails(card?'card':'node')} aria-label={card?'Описание выбранной карты':node?'Подробнее об узле':'Выберите карту или клетку'}>
    <strong>{card?CARDS[card].name:selection?`${coordinate(selection.cell)} · ${node?.name??'Разведка'}`:'Выберите карту или клетку'}{(card||node)&&<Info size={14}/>}</strong>
    <span>{summary}</span>
   </button>
   {card&&<button className="table-icon table-exchange" disabled={!canExchange} onClick={()=>onDetails('exchange')} aria-label={(me.exchangeRound??0)===view.round?'Замена уже использована':'Бесплатно заменить карту'} title="Бесплатно заменить карту"><Shuffle size={18}/><small>Замена</small></button>}
   {(card||selection)&&<button className="table-icon table-clear" aria-label="Отменить выбор" onClick={onClear}><X size={18}/></button>}
   {action&&<button className="table-play" disabled={!myTurn||busy||!status?.ok} onClick={()=>onAction(action)}>{busy?<LoaderCircle className="spin" size={16}/>:<Play size={15}/>}<span>{card?'Сыграть':'Скан'}</span></button>}
  </section>
 </main>;
}
