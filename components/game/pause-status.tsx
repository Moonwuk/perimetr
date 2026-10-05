'use client';
import {Pause,Play} from 'lucide-react';
import type {View} from '@/lib/game/engine';
import type {PauseDecision} from '@/lib/game/connection';
import './pause-status.css';

export function PauseStatus({view,busy=false,onPause}:{view:View;busy?:boolean;onPause:(decision:PauseDecision)=>void}){
 if(view.status!=='playing'||!view.pause)return null;
 const paused=view.pause.pausedAt!==null,requestedByMe=view.pause.requestedBy===view.viewer;
 return <section className="pause-status" aria-label="Пауза матча">
  <div className="pause-status-heading"><Pause size={18} aria-hidden="true"/><strong role="status">{paused?'Матч на паузе':requestedByMe?'Вы предложили паузу':'Соперник просит паузу'}</strong></div>
  <p>{paused?'Таймер переподключения остановлен. Продолжить может любой игрок.':'До согласия второго игрока матч продолжается.'}</p>
  <div className="pause-status-actions">
   {paused?<button className="primary-button" disabled={busy} onClick={()=>onPause('resume')}><Play size={16}/>Продолжить матч</button>:requestedByMe?<button className="quiet-button" disabled={busy} onClick={()=>onPause('cancel')}>Отменить запрос</button>:<><button className="primary-button" disabled={busy} onClick={()=>onPause('accept')}>Согласиться</button><button className="quiet-button" disabled={busy} onClick={()=>onPause('decline')}>Продолжить без паузы</button></>}
  </div>
 </section>;
}
