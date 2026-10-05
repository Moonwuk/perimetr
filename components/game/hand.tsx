'use client';
import {Network,ScanLine,Shield,ShieldCheck,KeyRound,Target,Eye,EyeOff,Layers3,Mail,Wrench,RotateCcw,Unplug,LockKeyhole,Server,Zap,TrendingUp} from 'lucide-react';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {CardFace} from './card-face';
import {CARDS,cardReadiness,actionStatus,type CardId,type CardKind,type View} from '@/lib/game/engine';
const cardIcons={scan:ScanLine,entry:Unplug,pivot:Network,key:KeyRound,target:Target,shield:Shield,patch:Wrench,eye:Eye,backup:RotateCcw,stealth:EyeOff,cards:Layers3,purge:ShieldCheck,mail:Mail,lock:LockKeyhole,server:Server,trend:TrendingUp,zap:Zap};
export const kindLabels={attack:'Атака',defense:'Защита',economy:'Экономика'};
export function CardIcon({id,size=22}:{id:CardId;size?:number}){const Icon=cardIcons[CARDS[id].icon as keyof typeof cardIcons];return <Icon size={size} strokeWidth={1.7}/>;}
export function Hand({view,selected,busy,onSelect,category,onCategoryChange,onDraw,compact=false}:{view:View;selected:CardId|null;busy:boolean;onSelect:(card:CardId)=>void;category:CardKind|'all';onCategoryChange:(kind:CardKind|'all')=>void;onDraw:()=>void;compact?:boolean}){
 const me=view.players[view.viewer],myTurn=view.status==='playing'&&view.turn===view.viewer;
 const states=new Map(me.hand.map(c=>[c,cardReadiness(view,c)]));
 const blocked=myTurn&&view.ap>0&&me.hand.length>0&&me.hand.every(c=>!states.get(c)!.ok);
 const categories=['all','attack','defense','economy'] as const;
 return <>
  {!compact&&<div className="hand-heading"><h2><Layers3 size={17}/> Ваша рука <span>{me.hand.length}</span></h2><button disabled={!myTurn||busy||!actionStatus(view,{type:'draw'}).ok} onClick={onDraw}>Добрать <b>1 <Zap size={12}/></b></button><small>{me.deckCount} в колоде</small></div>}
  {!compact&&blocked&&<p className="hand-help">{(me.exchangeRound??0)!==view.round?'Нет доступных карт. Выберите карту и нажмите «Заменить» или используйте разведку без карты.':'Замена уже использована. Можно разведать поле, обслужить свою сеть или передать ход.'}</p>}
  <Tabs value={category} onValueChange={kind=>onCategoryChange(kind as CardKind|'all')}>
   <TabsList className="hand-tabs" aria-label="Категории карт в руке">{categories.map(kind=><TabsTrigger key={kind} value={kind}>{kind==='all'?'Все':kindLabels[kind]} <b>{kind==='all'?me.hand.length:me.hand.filter(c=>CARDS[c].kind===kind).length}</b></TabsTrigger>)}</TabsList>
   {categories.map(kind=><TabsContent key={kind} value={kind}><div className="compact-hand">{compact&&<button className="hand-draw" disabled={!myTurn||busy||!actionStatus(view,{type:'draw'}).ok} onClick={onDraw} aria-label={`Добрать карту за 1 действие, в колоде ${me.deckCount}`}><Layers3 size={19}/><span>Добор</span><b>1 <Zap size={12}/></b></button>}{me.hand.filter(c=>kind==='all'||CARDS[c].kind===kind).map((c,i)=>{const def=CARDS[c],state=states.get(c)!;return <button key={`${i}-${c}`} className={`hand-card comic-hand-card ${def.kind} ${selected===c?'selected':''} ${!state.ok?'unavailable':''}`} onClick={()=>onSelect(c)} aria-pressed={selected===c} aria-label={`${def.name}: ${def.money} кредитов, ${def.cost} действия. ${def.short} ${state.ok?state.label==='Есть контрмера'?'На найденных целях есть контрмеры. Подробности по кнопке «О карте».':'Нажмите, чтобы выбрать карту.':state.reason}`}><CardFace id={c} variant="compact" decorative unavailableLabel={!state.ok?state.label:state.label==='Есть контрмера'?'Есть контрмера':undefined}/></button>;})}{!me.hand.some(c=>kind==='all'||CARDS[c].kind===kind)&&<p className="hand-empty">{me.hand.length?'Нет карт этой категории. Откройте «Все» и замените любую карту бесплатно.':'Доберите карту или разведайте поле.'}</p>}</div></TabsContent>)}
  </Tabs>
 </>;
}
