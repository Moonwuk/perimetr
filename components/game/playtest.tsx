'use client';
import {t} from '@/lib/game/translate';

import {Shield,KeyRound,RotateCcw,Copy,Wifi,RefreshCw,X,Flag,Pause} from 'lucide-react';
import {COUNTER_LABELS,RESERVE_COST,actionStatus,type View,type Action,type Countermeasure} from '@/lib/game/engine';
import {type ConnectionInfo,type PauseDecision} from '@/lib/game/connection';
import {ConnectionStatus} from './connection-status';
import {PauseStatus} from './pause-status';

export function ReservePanel({view,busy,onAction}:{view:View;busy:boolean;onAction:(a:Action)=>void}){
 const me=view.players[view.viewer];
 return <div className="reserve-panel"><p>{t(RESERVE_COST)}{t(" кредитов · 1 действие.")}<br/>{t("Действует до первого подходящего удара.")}</p>{t(me.reserve&&me.reserve!=='hidden'&&<strong className="reserve-active">{t("На дежурстве: ")}{t(COUNTER_LABELS[me.reserve])}</strong>)}<div className="reserve-options">{t(([{counter:'ddos',icon:Shield,label:'Против DDoS',text:'Сохранить доход и контракты.'},{counter:'auth',icon:KeyRound,label:'Защита аккаунтов',text:'От фишинга или подмены платежа.'},{counter:'backup',icon:RotateCcw,label:'Против саботажа',text:'Отразить сбой и удалить доступ.'}] as const).map(({counter,icon:Icon,label,text})=>{const action:Action={type:'reserve',counter:counter as Countermeasure},status=actionStatus(view,action);return <button key={counter} disabled={busy||!status.ok} onClick={()=>onAction(action)}><Icon size={22}/><strong>{t(label)}</strong><span>{t(text)}</span>{t(!status.ok&&<small>{t(status.reason)}</small>)}</button>;}))}</div><details className="reserve-hint"><summary>{t("Как это работает?")}</summary><p>{t("Отражает один удар выбранного типа по любому узлу. Соперник видит готовность, но тип узнает только при отражении. Постоянная защита узла расходуется первой. Неиспользованное дежурство сохраняется между ходами. Тип можно заменить за полную стоимость; подготовка доступна один раз за свой ход.")}</p></details></div>;
}

export function RoomPanel({code,connection,opponentStatus,expiresAt,visibility='private',canClose=false,busy=false,view,connectionInfo,onClose,onCopy,onReconnect,onSurrender,onClaimDisconnect,onPause}:{code:string;connection:string;opponentStatus:string;expiresAt?:number;visibility?:'private'|'public';canClose?:boolean;busy?:boolean;view?:View;connectionInfo?:ConnectionInfo|null;onClose?:()=>void;onCopy:()=>void;onReconnect:()=>void;onSurrender?:()=>void;onClaimDisconnect?:()=>void;onPause?:(decision:PauseDecision)=>void}){
 const playing=view?.status==='playing',setup=view&&['waiting','setup'].includes(view.status),me=view?.players[view.viewer],opponent=view?.players[1-view.viewer];
 const graceMinutes=Math.round((connectionInfo?.graceMs??120_000)/60_000);
 return <div className="room-panel">
  <div className="room-invite"><span>{t(visibility==='public'?'Открытая комната':'Комната по приглашению')}</span><strong>{t(code)}</strong><button className="primary-button" onClick={onCopy}><Copy size={18}/>{t(" Приглашение")}</button></div>
  <div className="room-connection" role="status"><Wifi size={19}/><span>{t(connection)}<small>{t(opponentStatus)}</small></span><button className="quiet-button" onClick={onReconnect} aria-label={t("Проверить связь")}><RefreshCw size={18}/></button></div>
  {t(setup&&<div className="room-readiness" role="status"><strong>{t(view.status==='waiting'?(me?.ready?'Вы готовы. Ждём второго игрока.':'Ожидаем второго игрока. Вы можете подготовить сеть.'):(me?.ready?'Вы готовы. Соперник расставляет сеть.':opponent?.ready?'Соперник готов. Подтвердите свою расстановку.':'Оба игрока расставляют сеть.'))}</strong><p>{t(view.status==='waiting'?'Отправьте приглашение другу. Для старта оба участника должны подтвердить расстановку.':me?.ready?'Игра начнётся после его подтверждения.':'На поле можно изменить сеть или сразу использовать рекомендованную расстановку и нажать «Готов».')}</p></div>)}
  <ConnectionStatus info={connectionInfo??null} busy={busy} onReconnect={onReconnect} onClaimDisconnect={onClaimDisconnect}/>
  {t(playing&&onPause&&(view.pause?<PauseStatus view={view} busy={busy} onPause={onPause}/>:<button className="secondary-button" disabled={busy} onClick={()=>onPause('request')}><Pause size={18}/>{t("Предложить паузу")}</button>))}
  {t(playing&&<p className="muted-small">{t("Паузу должны принять оба игрока. Пока она действует, ходы и таймер обрыва связи остановлены; продолжить может любой.")}</p>)}
  <p>{t(playing?'Выход во время матча — сдача и победа соперника. ':'До начала матча хозяин может закрыть комнату. ')}{t("При случайном обрыве связи даётся ")}{t(graceMinutes)}{t(" минуты на возвращение. Затем подключённый соперник может завершить матч победой. Автоматического поражения без его подтверждения нет.")}</p>
  <p>{t("Чтобы вернуться, откройте игру в том же приложении или браузере и нажмите «Вернуться в комнату». Сворачивание приложения приостанавливает связь — отсчёт восстановления продолжится.")}</p>
  <p className="muted-small">{t("Комната хранится до ")}{t(expiresAt?new Date(expiresAt).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'следующего дня')}.</p>
  <details><summary>{t("Как провести первый тест вдвоём")}</summary><ol><li>{t("Откройте игру на двух устройствах и отправьте второму игроку приглашение.")}</li><li>{t("Подтвердите обе расстановки и сыграйте партию.")}</li><li>{t("Ненадолго перезапустите игру и вернитесь в комнату: деньги, карты и очередь хода должны сохраниться.")}</li><li>{t("После результата скопируйте отчёт. Сыграйте реванш: первый ход поменяется.")}</li></ol><p>{t("Для обратной связи: модель телефона, удобство выбора карт, ощущение силы атак и защиты.")}</p></details>
  {t(playing&&onSurrender&&<button className="room-close" disabled={busy} onClick={onSurrender}><Flag size={18}/>{t("Выйти и сдаться")}</button>)}
  {t(!playing&&canClose&&onClose&&<button className="room-close" disabled={busy} onClick={onClose}><X size={18}/>{t("Закрыть комнату")}</button>)}
 </div>;
}

export function matchReport(view:View,code?:string){
 const reason=view.finishReason==='disconnect'?'соперник не вернулся после обрыва связи':view.finishReason==='surrender'||view.logs.some(l=>l.text.includes('сдаётся.'))?'сдача игрока':'сравнение казны';
 return [`КОНТУР 0.5 · тест ${code??view.mode} · матч ${view.matchNumber}`,`Завершение: ${reason}. Раундов: ${view.round}. Первый ход: компания ${view.firstPlayer+1}. Победитель: ${view.winner===null?'ничья':'компания '+(view.winner+1)}.`,...view.players.map((p,i)=>{const s=view.stats?.[i];return `Компания ${i+1}: казна ${p.money}, доход за матч ${p.earned}${s?`, потрачено ${s.spent}; карты и дежурства: атака/защита/экономика ${s.attacks}/${s.defenses}/${s.economy}; отражено ${s.blocked}; украдено ${s.stolen}; потеряно из казны ${s.cashLost}`:''}.`;})].map(line=>t(line)).join('\n');
}
