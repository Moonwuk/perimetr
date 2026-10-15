'use client';
import {useState} from 'react';
import {GridBoard,actionFor,type Selection} from './board';
import {CARDS,NODES,actionStatus,viewGame,type Action,type CardId} from '@/lib/game/engine';
import {SCENARIOS,trainingGame,trainingAction,trainingComplete,type Scenario} from '@/lib/game/training';
import {t} from '@/lib/game/translate';
export function Training(){
 const [scenario,setScenario]=useState<Scenario>('response'),[game,setGame]=useState(()=>trainingGame('response'));
 const [selection,setSelection]=useState<Selection|null>(null),[card,setCard]=useState<CardId|null>(null),[done,setDone]=useState(false),[error,setError]=useState('');
 const view=viewGame(game,0),side=scenario==='response'?'own':'enemy',node=selection?NODES.find(n=>view.players[side==='own'?0:1].layout[n.id]===selection.cell)?.id:undefined;
 const action=actionFor(view,card,selection),status=action?actionStatus(view,action):null,won=trainingComplete(scenario,game);
 const restart=(id:Scenario)=>{setScenario(id);setGame(trainingGame(id));setSelection(null);setCard(null);setDone(false);setError('');};
 const play=(a:Action)=>{try{const next=trainingAction(game,a);setGame(next);setCard(null);if(next.ap===0)setDone(true);}catch(e){setError((e as Error).message);}};
 return <div className="training"><label>{t('Учебная ситуация')}<select value={scenario} onChange={e=>restart(e.target.value as Scenario)}>{Object.entries(SCENARIOS).map(([id,s])=><option key={id} value={id}>{t(s.name)}</option>)}</select></label><p>{t(SCENARIOS[scenario].goal)}</p><strong>{t(`Осталось действий: ${game.ap}`)}</strong>
 <GridBoard view={view} side={side} selected={selection} card={card} onSelect={setSelection}/>
 {!done&&<><div className="training-hand">{game.players[0].hand.map((c,i)=><button className="secondary-button" key={`${c}-${i}`} aria-pressed={card===c} onClick={()=>setCard(card===c?null:c)}>{t(CARDS[c].name)}</button>)}</div>
 {action&&card&&<div><p>{t(status?.ok?status.preview:status?.reason)}</p><button className="primary-button" disabled={!status?.ok} onClick={()=>play(action)}>{t('Сыграть')}</button></div>}
 {node&&side==='own'&&!card&&<div className="training-hand">{(['investigate','cleanse','isolate','restore'] as const).map((type,i)=>{const a:Action={type,node,side:'own'},s=actionStatus(view,a);return <button key={type} className="secondary-button" title={t(s.ok?s.preview:s.reason)} disabled={!s.ok} onClick={()=>play(a)}>{t(['Расследовать','Очистить','Изолировать','Восстановить'][i])}</button>;})}</div>}
 <button className="quiet-button" onClick={()=>setDone(true)}>{t('Завершить и разобрать')}</button></>}
 {error&&<p role="alert">{t(error)}</p>}
 {done&&<div className="learn-box"><div><strong>{t(won?'Цель выполнена':'Цель пока не выполнена')}</strong><p>{t(SCENARIOS[scenario].lesson)}</p><button className="secondary-button" onClick={()=>restart(scenario)}>{t('Попробовать снова')}</button></div></div>}
 </div>;
}
