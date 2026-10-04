'use client';
import { useState } from 'react';
import { Globe2, Monitor, Database, HardDrive, Server, Shield, Eye, Check, Shuffle, LockKeyhole, ScanLine } from 'lucide-react';
import { NODES, CORE_NODES, coordinate, deploymentOf, deploymentError, actionStatus, scanArea, CARDS, attackCounter, defenseSummary, COUNTER_LABELS, type View, type NodeId, type Side, type CardId, type Deployment, type Action } from '@/lib/game/engine';
import {DefenseFlags,SetupProtection} from './countermeasures';
export const nodeIcons={web:Globe2,workstation:Monitor,database:Database,files:HardDrive,control:Server,service1:Server,service2:Server,service3:Server};
export type Selection={cell:number;side:Side};
export function actionFor(view:View,card:CardId|null,selection:Selection|null):Action|null{
 if(card&&CARDS[card].side==='none')return {type:'card',card};
 if(!selection)return null;
 if(!card&&selection.side==='enemy')return {type:'scan',cell:selection.cell,side:'enemy'};
 if(!card)return null;
 const p=view.players[selection.side==='own'?view.viewer:1-view.viewer];
 const node=NODES.find(n=>p.layout[n.id]===selection.cell)?.id;
 return {type:'card',card,cell:selection.cell,side:selection.side,node};
}
export function GridBoard({view,side,selected,card,onSelect}:{view:View;side:Side;selected:Selection|null;card:CardId|null;onSelect:(s:Selection)=>void}){
 const own=side==='own',me=view.players[view.viewer],p=view.players[own?view.viewer:1-view.viewer];
 const area=selected?.side===side&&(!card||card==='recon')&&!own?scanArea(selected.cell,card==='recon'):[];
 return <div className={`grid-board ${own?'own-grid':'enemy-grid'}`}>
  <div className="grid-axis"><span/>{'ABCDE'.split('').map(n=><span key={n}>{n}</span>)}</div>
  <div className="grid-with-axis"><div className="row-axis">{[1,2,3,4,5].map(n=><span key={n}>{n}</span>)}</div><div className="battle-grid" role="group" aria-label={own?'Ваша сеть':'Скрытая сеть соперника'}>
   {Array.from({length:25},(_,cell)=>{const node=NODES.find(n=>p.layout[n.id]===cell),state=node?p.nodes[node.id]:null,known=own||me.scanned.includes(cell),active=selected?.cell===cell&&selected.side===side;const Icon=node?nodeIcons[node.id]:null;const candidate=actionFor(view,card,{cell,side});const possible=!!card&&!!candidate&&actionStatus(view,candidate).ok,counter=card&&state&&side==='enemy'?attackCounter(card,state,p.reserve):null;
    return <button key={cell} type="button" aria-pressed={active} onClick={()=>onSelect({cell,side})} className={`grid-cell ${known?'explored':'fog'} ${node?'occupied':''} ${active?'chosen':''} ${possible&&!counter?'eligible':''} ${possible&&counter?'countered':''} ${card&&!possible?'invalid-target':''} ${area.includes(cell)?'scan-preview':''} ${state?.access?'intrusion':''} ${state?.isolated||state?.offline?'disconnected':''}`} aria-label={`${coordinate(cell)}: ${node?node.name:known?'пусто':'не разведано'}${state?.access?', доступ '+state.access:''}${state?.isolated?', изоляция':''}${state?.offline?', отключён':''}${state?'. '+defenseSummary(state):''}${counter?'. Контрмера: '+COUNTER_LABELS[counter]:''}`}>
     <span className="cell-coordinate">{coordinate(cell)}</span>{Icon?<><Icon className="cell-icon" size={24}/><span className="cell-name">{node!.id==='workstation'?'Станция':node!.id==='database'?'База':node!.id==='control'?'Доступ':node!.id==='web'?'Веб':node!.id==='files'?'Архив':'Сервер'}</span><span className="cell-flags"><DefenseFlags node={state!}/>{(state!.isolated||state!.offline)&&<LockKeyhole size={11}/ >}{state!.access>0&&<b>{state!.access===2?'ADM':'ACC'}</b>}</span></>:<span className="cell-empty">{known?'·':'?'}</span>}
    </button>;
   })}
  </div></div>
 </div>;
}
export function DeployPanel({view,busy,onDeploy,onCopy,onHome,roomCode}:{view:View;busy:boolean;onDeploy:(d:Deployment)=>void;onCopy:()=>void;onHome:()=>void;roomCode?:string}){
 const me=view.players[view.viewer];const [d,setD]=useState<Deployment>(()=>deploymentOf(me));const [active,setActive]=useState(0);const spent=[d.shields,d.sensors,d.auth??[],d.backups??[]].reduce((sum,values)=>sum+values.reduce((a,b)=>a+b,0),0);
 const place=(cell:number)=>{setD(old=>{const layout=[...old.layout],other=layout.indexOf(cell);if(other>=0)layout[other]=layout[active];layout[active]=cell;return {...old,layout};});};
 const randomize=()=>{const values=Array.from({length:25},(_,i)=>i);for(let i=24;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[values[i],values[j]]=[values[j],values[i]];}setD({...d,layout:values.slice(0,5)});};
 if(me.ready)return <div className="setup-wait"><Check size={46}/><h1>Сеть готова</h1><p>Ждём расстановку соперника.</p>{roomCode&&<><strong className="room-code">{roomCode}</strong><button className="primary-button" onClick={onCopy}>Пригласить игрока</button><small>Другу нужен доступ к этому сайту.</small></>}<button className="quiet-button" onClick={onHome}>В меню · место сохранится</button></div>;
 return <main className="deployment-screen"><div className="setup-title"><span className="eyebrow">ПОДГОТОВКА · {me.name}</span><h1>Спрячьте свою сеть</h1><p>Выберите узел, затем клетку. Все пять узлов занимают по одной клетке.</p></div>
 <div className="deployment-grid"><section><div className="setup-map-header"><h2>Ваше поле</h2><button className="quiet-button" onClick={randomize}><Shuffle size={16}/> Перемешать</button></div><div className="grid-board own-grid"><div className="grid-axis"><span/>{'ABCDE'.split('').map(c=><span key={c}>{c}</span>)}</div><div className="grid-with-axis"><div className="row-axis">{[1,2,3,4,5].map(n=><span key={n}>{n}</span>)}</div><div className="battle-grid">{Array.from({length:25},(_,cell)=>{const index=d.layout.indexOf(cell),node=CORE_NODES[index],Icon=node?nodeIcons[node.id]:null;return <button key={cell} className={`grid-cell explored ${node?'occupied':''} ${index===active?'chosen':''}`} onClick={()=>place(cell)} aria-label={`${coordinate(cell)}${node?', '+node.name:', свободно'}`}><span className="cell-coordinate">{coordinate(cell)}</span>{Icon?<><Icon size={24}/><span className="cell-name">{node.id==='workstation'?'Станция':node.id==='database'?'База':node.id==='control'?'Доступ':node.id==='web'?'Веб':node.id==='files'?'Архив':'Сервер'}</span><span className="cell-flags"><DefenseFlags node={{shield:d.shields[index],auth:d.auth?.[index]??0,backup:!!d.backups?.[index],sensor:!!d.sensors[index]}}/></span></>:<span className="cell-empty">+</span>}</button>;})}</div></div></div></section>
 <section className="setup-controls"><div className="setup-units">{CORE_NODES.map((node,i)=>{const Icon=nodeIcons[node.id];return <button key={node.id} onClick={()=>setActive(i)} className={i===active?'active':''} aria-pressed={i===active}><Icon size={20}/><span><strong>{node.name}</strong><small>{node.subtitle}</small></span><b>{coordinate(d.layout[i])}</b></button>;})}</div><div className="setup-defense"><div><h2>Защита узла</h2><span>{4-spent} / 4 жетона</span></div><p>{CORE_NODES[active].name}</p><SetupProtection deployment={d} index={active} spent={spent} onChange={setD}/><small>Каждый заряд стоит один жетон. Анти-DDoS — от перегрузки, аккаунты — от фишинга, копия — от саботажа. Датчик обнаруживает проникновение.</small></div><button className="primary-button setup-ready" disabled={busy||!!deploymentError(d)} onClick={()=>onDeploy(d)}><Check size={19}/> Подтвердить расстановку</button>{roomCode&&<button className="quiet-button" onClick={onCopy}>Комната {roomCode} · приглашение</button>}</section></div><p className="setup-note"><ScanLine size={16}/> Соседство клеток не создаёт сетевую связь. Маршруты между найденными узлами показаны в их описании.</p></main>;
}
