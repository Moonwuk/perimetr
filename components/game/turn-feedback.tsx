'use client';

import {useState} from 'react';
import {ChevronDown,ChevronUp,ClipboardList,X} from 'lucide-react';
import type {Action,View} from '@/lib/game/engine';
import {describeAction,summarizeTurn,type ActionFeedback,type TurnSummary} from '@/lib/game/action-feedback';
import './turn-feedback.css';

type FeedbackState={key:string;seen:string;lastViews:[View|null,View|null];turnKeys:[string,string];summary:TurnSummary|null;result:ActionFeedback|null};
const emptyState=(key:string):FeedbackState=>({key,seen:'',lastViews:[null,null],turnKeys:['',''],summary:null,result:null});
function observe(state:FeedbackState,view:View|null,key:string):FeedbackState{
 let next=state.key===key?state:emptyState(key);
 if(!view)return next;
 const seen=[view.matchNumber,view.viewer,view.round,view.turn,view.status,view.serial,view.ap,view.players[view.viewer].money,view.players[view.viewer].hand.join(',')].join(':');
 if(next.seen===seen)return next;
 next={...next,seen};
 if(view.status==='playing'&&view.turn===view.viewer){
  const viewer=view.viewer,turnKey=`${view.matchNumber}:${viewer}:${view.round}`;
  if(next.turnKeys[viewer]!==turnKey){
   const turnKeys=[...next.turnKeys] as [string,string];turnKeys[viewer]=turnKey;
   next={...next,turnKeys,summary:summarizeTurn(next.lastViews[viewer],view),result:null};
  }
  const lastViews=[...next.lastViews] as [View|null,View|null];lastViews[viewer]=view;
  next={...next,lastViews};
 }
 return next;
}

/** Keep snapshots at the end of our own actions, never derive events from hidden state. */
export function useTurnFeedback(view:View|null,resetKey:string){
 const [state,setState]=useState(()=>observe(emptyState(resetKey),view,resetKey));
 const next=observe(state,view,resetKey);
 if(next!==state)setState(next);
 const confirm=(action:Action,before:View,after:View)=>{
  const result=describeAction(before,action,after);
  // End-turn acknowledgements can arrive after a local handoff. Keep the previous
  // own-turn baseline, including the money before the round's payout.
  if(!result)return;
  setState(current=>{
   if(current.key!==resetKey)return current;
   const lastViews=[...current.lastViews] as [View|null,View|null];lastViews[before.viewer]=after;
   return {...current,lastViews,result};
  });
 };
 return {summary:view?.status==='playing'&&view.turn===view.viewer&&next.summary?.viewer===view.viewer?next.summary:null,result:view?.status==='playing'&&next.result?.viewer===view.viewer?next.result:null,confirm};
}

export function TurnFeedback({summary,result}:{summary:TurnSummary|null;result:ActionFeedback|null}){
 const id=result?.id??summary?.id??'';
 const [expandedId,setExpandedId]=useState(''),[dismissedId,setDismissedId]=useState('');
 if(!summary&&!result)return null;
 const expanded=expandedId===id,dismissed=dismissedId===id;
 const title=result?.title??'Что изменилось';
 const short=result?result.lines[0]:summary?.changes[0];
 const detailsId=`turn-feedback-${id.replaceAll(':','-')}`;
 const cost=result?`${result.spent} ¤ · ${result.apSpent} ОД`:`+${summary!.expectedIncome} ¤ ожидается`;
 const toggle=()=>{setDismissedId('');setExpandedId(expanded?'':id);};
 return <section className={`turn-feedback ${result?.kind??'normal'} ${dismissed?'is-dismissed':''}`} aria-label="Итог действий" data-turn-feedback={result?'action':'turn'}>
  <div className="turn-feedback-heading">
   <button type="button" className="turn-feedback-open" onClick={toggle} aria-expanded={expanded&&!dismissed} aria-controls={detailsId}>
    <ClipboardList size={15} aria-hidden="true"/>
    <span><strong>{dismissed?result?'Итог последнего действия':'Что изменилось':title}</strong>{!dismissed&&<small>{cost}</small>}</span>
    {expanded&&!dismissed?<ChevronUp size={15} aria-hidden="true"/>:<ChevronDown size={15} aria-hidden="true"/>}
   </button>
   {!dismissed&&<button type="button" className="turn-feedback-dismiss" onClick={()=>{setDismissedId(id);setExpandedId('');}} aria-label="Свернуть итог действий"><X size={15}/></button>}
  </div>
  {!dismissed&&!expanded&&<p className="turn-feedback-short" role="status">{short}</p>}
  <div id={detailsId} className="turn-feedback-details" hidden={!expanded||dismissed}>
   {result&&<ul>{result.lines.map((line,index)=><li key={index}>{line}</li>)}</ul>}
   {summary&&<div className="turn-feedback-turn"><strong>{result?'К началу вашего хода':'Ваша сеть'}</strong>
    <ul>{summary.changes.map((line,index)=><li key={index}>{line}</li>)}</ul>
    {summary.problems.length>0&&<div className="turn-feedback-problems" aria-label="Известные проблемы">{summary.problems.map(problem=><span key={problem}>{problem}</span>)}</div>}
    <p>Ожидаемое начисление: <b>+{summary.expectedIncome} ¤</b> в конце раунда, если ничего не изменится.</p>
    {summary.nextRoundIncome!==summary.expectedIncome&&<p>В следующем полном раунде: <b>+{summary.nextRoundIncome} ¤</b>, если работающие узлы останутся доступны.</p>}
    {summary.lostIncome>0&&<p>Недоступный доход: {summary.lostIncome} ¤. Ремонт не возвращает доход, уже потерянный в этом раунде.</p>}
   </div>}
  </div>
 </section>;
}
