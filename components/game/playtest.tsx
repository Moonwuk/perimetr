'use client';
import {Shield,KeyRound,RotateCcw,Copy,Wifi,RefreshCw,X,Flag,Pause} from 'lucide-react';
import {COUNTER_LABELS,RESERVE_COST,actionStatus,type View,type Action,type Countermeasure} from '@/lib/game/engine';
import {type ConnectionInfo,type PauseDecision} from '@/lib/game/connection';
import {ConnectionStatus} from './connection-status';
import {PauseStatus} from './pause-status';

export function ReservePanel({view,busy,onAction}:{view:View;busy:boolean;onAction:(a:Action)=>void}){
 const me=view.players[view.viewer];
 return <div className="reserve-panel"><p>{RESERVE_COST} кредитов · 1 действие.<br/>Действует до первого подходящего удара.</p>{me.reserve&&me.reserve!=='hidden'&&<strong className="reserve-active">На дежурстве: {COUNTER_LABELS[me.reserve]}</strong>}<div className="reserve-options">{([{counter:'ddos',icon:Shield,label:'Против DDoS',text:'Сохранить доход и контракты.'},{counter:'auth',icon:KeyRound,label:'Защита аккаунтов',text:'От фишинга или подмены платежа.'},{counter:'backup',icon:RotateCcw,label:'Против саботажа',text:'Отразить сбой и удалить доступ.'}] as const).map(({counter,icon:Icon,label,text})=>{const action:Action={type:'reserve',counter:counter as Countermeasure},status=actionStatus(view,action);return <button key={counter} disabled={busy||!status.ok} onClick={()=>onAction(action)}><Icon size={22}/><strong>{label}</strong><span>{text}</span>{!status.ok&&<small>{status.reason}</small>}</button>;})}</div><details className="reserve-hint"><summary>Как это работает?</summary><p>Отражает один удар выбранного типа по любому узлу. Соперник видит готовность, но тип узнает только при отражении. Постоянная защита узла расходуется первой. Неиспользованное дежурство сохраняется между ходами. Тип можно заменить за полную стоимость; подготовка доступна один раз за свой ход.</p></details></div>;
}

export function RoomPanel({code,connection,opponentStatus,expiresAt,visibility='private',canClose=false,busy=false,view,connectionInfo,onClose,onCopy,onReconnect,onSurrender,onClaimDisconnect,onPause}:{code:string;connection:string;opponentStatus:string;expiresAt?:number;visibility?:'private'|'public';canClose?:boolean;busy?:boolean;view?:View;connectionInfo?:ConnectionInfo|null;onClose?:()=>void;onCopy:()=>void;onReconnect:()=>void;onSurrender?:()=>void;onClaimDisconnect?:()=>void;onPause?:(decision:PauseDecision)=>void}){
 const playing=view?.status==='playing',setup=view&&['waiting','setup'].includes(view.status),me=view?.players[view.viewer],opponent=view?.players[1-view.viewer];
 const graceMinutes=Math.round((connectionInfo?.graceMs??120_000)/60_000);
 return <div className="room-panel">
  <div className="room-invite"><span>{visibility==='public'?'Открытая комната':'Комната по приглашению'}</span><strong>{code}</strong><button className="primary-button" onClick={onCopy}><Copy size={18}/> Приглашение</button></div>
  <div className="room-connection" role="status"><Wifi size={19}/><span>{connection}<small>{opponentStatus}</small></span><button className="quiet-button" onClick={onReconnect} aria-label="Проверить связь"><RefreshCw size={18}/></button></div>
  {setup&&<div className="room-readiness" role="status"><strong>{view.status==='waiting'?(me?.ready?'Вы готовы. Ждём второго игрока.':'Ожидаем второго игрока. Вы можете подготовить сеть.'):(me?.ready?'Вы готовы. Соперник расставляет сеть.':opponent?.ready?'Соперник готов. Подтвердите свою расстановку.':'Оба игрока расставляют сеть.')}</strong><p>{view.status==='waiting'?'Отправьте приглашение другу. Для старта оба участника должны подтвердить расстановку.':me?.ready?'Игра начнётся после его подтверждения.':'На поле можно изменить сеть или сразу использовать рекомендованную расстановку и нажать «Готов».'}</p></div>}
  <ConnectionStatus info={connectionInfo??null} busy={busy} onReconnect={onReconnect} onClaimDisconnect={onClaimDisconnect}/>
  {playing&&onPause&&(view.pause?<PauseStatus view={view} busy={busy} onPause={onPause}/>:<button className="secondary-button" disabled={busy} onClick={()=>onPause('request')}><Pause size={18}/>Предложить паузу</button>)}
  {playing&&<p className="muted-small">Паузу должны принять оба игрока. Пока она действует, ходы и таймер обрыва связи остановлены; продолжить может любой.</p>}
  <p>{playing?'Выход во время матча — сдача и победа соперника. ':'До начала матча хозяин может закрыть комнату. '}При случайном обрыве связи даётся {graceMinutes} минуты на возвращение. Затем подключённый соперник может завершить матч победой. Автоматического поражения без его подтверждения нет.</p>
  <p>Чтобы вернуться, откройте игру в том же приложении или браузере и нажмите «Вернуться в комнату». Сворачивание приложения приостанавливает связь — отсчёт восстановления продолжится.</p>
  <p className="muted-small">Комната хранится до {expiresAt?new Date(expiresAt).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'следующего дня'}.</p>
  <details><summary>Как провести первый тест вдвоём</summary><ol><li>Откройте игру на двух устройствах и отправьте второму игроку приглашение.</li><li>Подтвердите обе расстановки и сыграйте партию.</li><li>Ненадолго перезапустите игру и вернитесь в комнату: деньги, карты и очередь хода должны сохраниться.</li><li>После результата скопируйте отчёт. Сыграйте реванш: первый ход поменяется.</li></ol><p>Для обратной связи: модель телефона, удобство выбора карт, ощущение силы атак и защиты.</p></details>
  {playing&&onSurrender&&<button className="room-close" disabled={busy} onClick={onSurrender}><Flag size={18}/>Выйти и сдаться</button>}
  {!playing&&canClose&&onClose&&<button className="room-close" disabled={busy} onClick={onClose}><X size={18}/>Закрыть комнату</button>}
 </div>;
}

export function matchReport(view:View,code?:string){
 const reason=view.finishReason==='disconnect'?'соперник не вернулся после обрыва связи':view.finishReason==='surrender'||view.logs.some(l=>l.text.includes('сдаётся.'))?'сдача игрока':'сравнение казны';
 return [`КОНТУР 0.5 · тест ${code??view.mode} · матч ${view.matchNumber}`,`Завершение: ${reason}. Раундов: ${view.round}. Первый ход: компания ${view.firstPlayer+1}. Победитель: ${view.winner===null?'ничья':'компания '+(view.winner+1)}.`,...view.players.map((p,i)=>{const s=view.stats?.[i];return `Компания ${i+1}: казна ${p.money}, доход за матч ${p.earned}${s?`, потрачено ${s.spent}; карты и дежурства: атака/защита/экономика ${s.attacks}/${s.defenses}/${s.economy}; отражено ${s.blocked}; украдено ${s.stolen}; потеряно из казны ${s.cashLost}`:''}.`;})].join('\n');
}
