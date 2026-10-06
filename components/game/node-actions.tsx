'use client';
import {t} from '@/lib/game/translate';

import {Eye,Info,RotateCcw,ShieldCheck,TriangleAlert,Unplug,X} from 'lucide-react';
import {actionStatus,nameOf,type Action,type NodeId,type View} from '@/lib/game/engine';
import {nodeIcons} from './board';

/** The same authoritative action checks as cards, exposed at the point of selection. */
export function NodeActions({view,node,coordinate,busy,onAction,onClear,onDetails}:{view:View;node:NodeId;coordinate:string;busy:boolean;onAction:(action:Action)=>void;onClear:()=>void;onDetails:()=>void}){
 const state=view.players[view.viewer].nodes[node];
 if(!state)return null;
 const Icon=nodeIcons[node],broken=state.offline||state.isolated;
 const actions=[
  {type:'restore',label:'Восстановить',icon:RotateCcw},
  {type:'investigate',label:'Расследовать',icon:Eye},
  {type:'isolate',label:'Изолировать',icon:Unplug},
  {type:'cleanse',label:'Очистить',icon:ShieldCheck},
 ] as const;
 const renderAction=(item:typeof actions[number],primary=false)=>{
  const action:Action={type:item.type,node,side:'own'},status=actionStatus(view,action),ActionIcon=item.icon;
  return <div className={`node-action ${primary?'node-action-primary':''}`} key={item.type}>
   <button type="button" disabled={busy||!status.ok} aria-describedby={`node-${item.type}-reason`} onClick={()=>onAction(action)}><ActionIcon size={18}/><span>{t(item.label)} · {t(status.cost)}{t(" ОД")}</span></button>
   <small id={`node-${item.type}-reason`}>{t(!status.ok?status.reason:primary?'Без затрат кредитов':item.type==='investigate'?'Найти скрытый доступ':item.type==='isolate'?'Остановить узел и его связи':item.type==='cleanse'?'Удалить обнаруженный доступ':'Включить узел')}</small>
  </div>;
 };
 return <section className="node-actions" aria-label={t("Действия узла")} data-node-actions={node}>
  <div className="node-actions-heading">
   <div className="node-identity"><Icon size={28}/><div><strong>{t(coordinate)} · {t(nameOf(node))}</strong><span className={broken?'node-warning':''}>{t(broken?<><TriangleAlert size={15}/>{t(state.isolated?'Узел изолирован':'Сервис отключён')}</>:state.detected?'Обнаружен чужой доступ':'Узел работает')}</span></div></div>
   {t(renderAction(actions[0],true))}
   <button className="table-icon" onClick={onClear} aria-label={t("Отменить выбор")}><X size={18}/></button>
  </div>
  <div className="node-actions-secondary">{t(actions.slice(1).map(item=>renderAction(item)))}</div>
  <div className="node-actions-note"><Info size={14}/><span>{t(state.detected?'Очистите чужой доступ перед восстановлением связи.':state.interrupted&&state.income>0?'Ремонт включит узел, но не вернёт потерянный доход.':'Действия узла не требуют карт и кредитов.')}</span><button onClick={onDetails}>{t("Об узле")}</button></div>
 </section>;
}
