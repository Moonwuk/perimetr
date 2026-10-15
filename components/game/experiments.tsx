'use client';
import {useState} from 'react';
import {t} from '@/lib/game/translate';
import {RULESETS,PLAYTEST_QUESTIONS,hasMechanic,type ServiceProfile} from '@/lib/game/experiments';
import {actionStatus,networkLinks,linkClosed,nameOf,coordinate,type View,type Action,type NodeId} from '@/lib/game/engine';

export function ExperimentActions({view,node,busy,onAction}:{view:View;node?:NodeId;busy:boolean;onAction:(a:Action)=>void}){
 const p=view.players[view.viewer],rules=view.ruleset??'baseline';
 if(rules==='baseline')return null;
 const button=(action:Action,label:string,key:string)=>{const s=actionStatus(view,action);return <div className="experiment-action" key={key}><button className="secondary-button" disabled={busy||!s.ok} onClick={()=>onAction(action)}>{t(label)}</button><small>{t(s.ok?s.preview:s.reason)}</small></div>;};
 return <section className="experiment-actions">
  {hasMechanic(rules,'contracts')&&node&&button({type:'contract',node},'Принять контракт · 80 ¤','contract')}
  {hasMechanic(rules,'segmentation')&&node&&networkLinks(p).filter(([a,b])=>a===node||b===node).map(([from,to])=>button({type:'route',from,to,closed:!linkClosed(p,from,to)},`${linkClosed(p,from,to)?'Открыть':'Закрыть'}: ${nameOf(from)} ↔ ${nameOf(to)}`,from+to))}
  {hasMechanic(rules,'preparation')&&p.prepared&&button({type:'resolve'},`Завершить саботаж: ${nameOf(p.prepared.node)}`,'resolve')}
 </section>;
}
export function ExperimentSummary({view,busy,onAction}:{view:View;busy:boolean;onAction:(a:Action)=>void}){
 const rule=view.ruleset??'baseline';
 return <section className="experiment-summary"><strong>{t(RULESETS[rule].name)}</strong><p>{t(RULESETS[rule].description)}</p>
 {view.players.map((p,i)=><div key={i}>
  {p.contract&&<p><b>{p.name}</b> · {t(nameOf(p.contract.node))} · {t(p.contract.status==='active'?`Контракт: ${p.contract.completedRounds}/2 полных раундов`:p.contract.status==='completed'?'Контракт выполнен':'Контракт сорван')}</p>}
  {p.prepared&&<p role="status">{t(`Сигнал: ${nameOf(p.prepared.node)} под угрозой саботажа.`)} {t(i===view.viewer?'Завершите на следующем своём ходу.':'Очистите доступ, изолируйте узел или подготовьте восстановление.')}</p>}
 </div>)}<ExperimentActions view={view} busy={busy} onAction={onAction}/>
 {hasMechanic(rule,'contracts')&&<p>{t('Выберите свой доходный узел → «Принять контракт».')}</p>}
 {hasMechanic(rule,'segmentation')&&<p>{t('Выберите свой узел, затем связь для закрытия или открытия.')}</p>}
 {hasMechanic(rule,'services')&&<p>{t('Сыграйте «Новый сервер» на свободную клетку, затем выберите профиль и подключение.')}</p>}
 </section>;
}
export function BuildOptions({view,action,busy,onBuild}:{view:View;action:Extract<Action,{type:'card'}>;busy:boolean;onBuild:(action:Action)=>void}){
 const [profile,setProfile]=useState<ServiceProfile>('public'),[parent,setParent]=useState<NodeId>('control');
 const move:Action={...action,profile,...(profile==='internal'?{parent}: {})};
 const status=actionStatus(view,move),choices:ServiceProfile[]=['public',...(hasMechanic(view.ruleset,'services')?['internal' as const]:[]),...(hasMechanic(view.ruleset,'decoy')?['decoy' as const]:[])];
 return <div className="build-options"><p>{t(`Клетка ${coordinate(action.cell!)} · 240 кредитов · 1 действие`)}</p><fieldset><legend>{t('Профиль сервиса')}</legend>{choices.map(value=><label key={value}><input type="radio" name="service-profile" checked={profile===value} onChange={()=>setProfile(value)}/>{t(value==='internal'?'Внутренний · +80 дохода':value==='decoy'?'Приманка · без дохода':`Публичный · +${hasMechanic(view.ruleset,'services')?120:100} дохода`)}</label>)}</fieldset>
 {profile==='internal'&&<label>{t('Единственное подключение')}<select aria-label={t('Единственное подключение')} value={parent} onChange={e=>setParent(e.target.value as NodeId)}>{(['web','workstation','database','files','control'] as NodeId[]).map(id=><option key={id} value={id}>{t(nameOf(id))}</option>)}</select></label>}
 <p>{t(profile==='internal'?'Внешний вход закрыт. Для атаки нужен доступ через выбранный связанный узел.':profile==='decoy'?'Выглядит как публичный сервер до тщательной разведки или попытки проникновения. Не приносит доход и не атакует в ответ.':'После обнаружения доступен для внешнего проникновения и DDoS.')}</p>
 <button className="primary-button" disabled={busy||!status.ok} onClick={()=>onBuild(move)}>{t('Построить')}</button><p>{t(status.ok?status.preview:status.reason)}</p></div>;
}
export function Debrief({view}:{view:View}){
 const episodes=view.episodes??[];
 return <section className="debrief"><h3>{t('Поворотные эпизоды')}</h3>{episodes.length?<ol>{episodes.map((e,i)=><li key={i}><b>{t(`Раунд ${e.round}`)}</b><p>{t(e.text)}</p></li>)}</ol>:<p>{t('В этой партии не зафиксированы эпизоды простоя, контрактов или подготовленных операций. Подробности — в журнале и отчёте.')}</p>}<p className="muted-small">{t('Это фактически произошедшие события. Разбор не утверждает, что другое решение гарантировало бы победу.')}</p><details><summary>{t('Вопросы после теста')}</summary><ol>{PLAYTEST_QUESTIONS.map(q=><li key={q}>{t(q)}</li>)}</ol><p>{t('Проведите два матча со сменой первого игрока. Для первичной проверки нужны пять пар игроков. Сохраните оба отчёта и ответы.')}</p></details></section>;
}
