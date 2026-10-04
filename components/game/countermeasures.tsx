'use client';
import {Shield,KeyRound,RotateCcw,Eye} from 'lucide-react';
import {type NodeState,type Deployment} from '@/lib/game/engine';

export function DefenseFlags({node}:{node:Pick<NodeState,'shield'|'auth'|'backup'|'sensor'>}){
 return <>{node.shield>0&&<span className="guard-ddos" title="Анти-DDoS"><Shield size={10}/>{node.shield}</span>}{node.auth>0&&<span className="guard-auth" title="Защита аккаунтов"><KeyRound size={10}/>{node.auth}</span>}{node.backup&&<RotateCcw className="guard-backup" size={11} aria-label="Резервная копия"/>}{node.sensor&&<Eye size={11} aria-label="Датчик"/>}</>;
}
export function DefenseDetails({node}:{node:NodeState}){
 return <div className="counter-details"><div className={node.shield?'protected':''}><Shield size={18}/><strong>Анти-DDoS <b>{node.shield}/2</b></strong><span>{node.shield?'Отразит DDoS. Фишинг и саботаж проходят.':'DDoS: потеря дохода и денег за срыв контрактов.'}</span></div><div className={node.auth?'protected':''}><KeyRound size={18}/><strong>Аккаунты <b>{node.auth}/2</b></strong><span>{node.auth?'Отразит фишинг. Технический вход проходит.':'Фишинг: кража до 60 кредитов и получение доступа.'}</span></div><div className={node.backup?'protected':''}><RotateCcw size={18}/><strong>Резервная копия <b>{node.backup?'1/1':'0/1'}</b></strong><span>{node.backup?'Отразит саботаж и удалит доступ. DDoS и фишинг проходят.':'Саботаж после проникновения: сбой и денежный штраф.'}</span></div></div>;
}
export function CounterGuide(){return <div className="counter-guide"><strong>Подберите атаку под защиту</strong><span><Shield size={17}/> Анти-DDoS отражает DDoS</span><span><KeyRound size={17}/> Защита аккаунтов отражает фишинг</span><span><RotateCcw size={17}/> Резервная копия отражает саботаж</span><p>Заряд контрмеры расходуется. Другие угрозы проходят. Разведка раскрывает защиты; зелёная рамка отмечает уязвимую цель, оранжевая — цель с подходящей контрмерой.</p></div>;}

const protectionTypes=[{field:'shields',label:'Анти-DDoS',icon:Shield,max:2},{field:'auth',label:'Аккаунты',icon:KeyRound,max:2},{field:'backups',label:'Копия',icon:RotateCcw,max:1},{field:'sensors',label:'Датчик',icon:Eye,max:1}] as const;
export function SetupProtection({deployment,index,spent,onChange}:{deployment:Deployment;index:number;spent:number;onChange:(value:Deployment)=>void}){
 return <div className="protection-setup">{protectionTypes.map(({field,label,icon:Icon,max})=>{const values=deployment[field]??[0,0,0,0,0],value=values[index];const change=(n:number)=>onChange({...deployment,[field]:values.map((v,i)=>i===index?n:v)});return <div key={field}><span><Icon size={16}/>{label}</span><button disabled={!value} aria-label={`Убрать: ${label}`} onClick={()=>change(value-1)}>−</button><b>{value}/{max}</b><button disabled={spent>=4||value>=max} aria-label={`Добавить: ${label}`} onClick={()=>change(value+1)}>+</button></div>;})}</div>;
}
