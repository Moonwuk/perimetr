'use client';
import {t} from '@/lib/game/translate';

import {RefreshCw,WifiOff} from 'lucide-react';
import {connectionCountdown,type ConnectionInfo} from '@/lib/game/connection';
import './connection-status.css';

export function ConnectionStatus({info,busy=false,onReconnect,onClaimDisconnect}:{info:ConnectionInfo|null;busy?:boolean;onReconnect:()=>void;onClaimDisconnect?:()=>void}){
 if(!info?.active||!info.reconnecting&&!info.opponentAway)return null;
 return <section className="connection-recovery" aria-label={t("Восстановление связи")}>
  <WifiOff size={19} aria-hidden="true"/>
  <div className="connection-recovery-copy">
   <strong role="status">{t(info.reconnecting?'Восстанавливаем вашу связь':'Соперник не отвечает')}</strong>
   {t(info.reconnecting?<p>{t(info.ownRemainingMs>0?<>{t("До права соперника завершить матч — ")}<b>{t(connectionCountdown(info.ownRemainingMs))}</b>.</>:'Время восстановления истекло. Сверяем состояние матча с сервером.')}{t(" Действия снова станут доступны после сверки.")}</p>:<p>{t(info.opponentRemainingMs>0?<>{t("Ждём возвращения ещё ")}<b>{t(connectionCountdown(info.opponentRemainingMs))}</b>{t(". Матч сохраняется.")}</>:'Время восстановления истекло. Можно зафиксировать победу или продолжить ждать.')}</p>)}
  </div>
  {t(info.reconnecting?<button className="quiet-button connection-recovery-button" onClick={onReconnect}><RefreshCw size={16}/>{t(" Проверить связь")}</button>:info.canClaim&&onClaimDisconnect?<button className="secondary-button connection-recovery-button" disabled={busy} onClick={onClaimDisconnect}>{t("Завершить победой")}</button>:null)}
 </section>;
}
