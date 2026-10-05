'use client';
import {RefreshCw,WifiOff} from 'lucide-react';
import {connectionCountdown,type ConnectionInfo} from '@/lib/game/connection';
import './connection-status.css';

export function ConnectionStatus({info,busy=false,onReconnect,onClaimDisconnect}:{info:ConnectionInfo|null;busy?:boolean;onReconnect:()=>void;onClaimDisconnect?:()=>void}){
 if(!info?.active||!info.reconnecting&&!info.opponentAway)return null;
 return <section className="connection-recovery" aria-label="Восстановление связи">
  <WifiOff size={19} aria-hidden="true"/>
  <div className="connection-recovery-copy">
   <strong role="status">{info.reconnecting?'Восстанавливаем вашу связь':'Соперник не отвечает'}</strong>
   {info.reconnecting?<p>{info.ownRemainingMs>0?<>До права соперника завершить матч — <b>{connectionCountdown(info.ownRemainingMs)}</b>.</>:'Время восстановления истекло. Сверяем состояние матча с сервером.'} Действия снова станут доступны после сверки.</p>:<p>{info.opponentRemainingMs>0?<>Ждём возвращения ещё <b>{connectionCountdown(info.opponentRemainingMs)}</b>. Матч сохраняется.</>:'Время восстановления истекло. Можно зафиксировать победу или продолжить ждать.'}</p>}
  </div>
  {info.reconnecting?<button className="quiet-button connection-recovery-button" onClick={onReconnect}><RefreshCw size={16}/> Проверить связь</button>:info.canClaim&&onClaimDisconnect?<button className="secondary-button connection-recovery-button" disabled={busy} onClick={onClaimDisconnect}>Завершить победой</button>:null}
 </section>;
}
