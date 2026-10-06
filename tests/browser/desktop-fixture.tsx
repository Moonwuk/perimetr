/** Development-only visual fixture, never a production entry point. */
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DuelTable,type TableDetail} from '../../components/game/tabletop';
import {type Selection} from '../../components/game/board';
import {CARDS,COUNTER_LABELS,NODES,actionStatus,coordinate,incomeOf,newGame,applyAction,viewGame,type Action,type CardId,type CardKind,type Countermeasure,type Side} from '../../lib/game/engine';
import {useLanguage} from '../../lib/game/language';
import {t} from '../../lib/game/translate';
import {describeAction} from '../../lib/game/action-feedback';
import {TurnFeedback,useTurnFeedback} from '../../components/game/turn-feedback';
import {CardPlayEffect,useCardPlayEffect,type CardPlayOrigin} from '../../components/game/card-play-effect';
import {CardFace} from '../../components/game/card-face';
import {ConnectionStatus} from '../../components/game/connection-status';
import {PauseStatus} from '../../components/game/pause-status';
import {Sheet,SheetContent,SheetDescription,SheetTitle} from '../../components/ui/sheet';
import type {PauseDecision} from '../../lib/game/connection';
import '../../app/globals.css';
import '../../components/game/tabletop.css';
import '../../components/game/desktop-table.css';
import '../../components/game/desktop-layout.css';
import '../../cloudflare/web/web.css';
function initial(){const g=newGame('local',['Моя компания','Компания «Вектор»'],71);g.status='playing';g.turn=0;g.ap=2;g.round=4;g.players.forEach(p=>p.ready=true);g.players[0].money=280;g.players[0].layout={...g.players[0].layout,web:7,workstation:22,database:12,files:4,control:15};g.players[1].layout={...g.players[1].layout,web:7,database:17};g.players[0].scanned=[7,17];g.players[1].reserve='ddos';g.players[0].hand=['ddos','optimize','shield','expand','patch'];g.players[0].nodes.web.offline=true;g.players[0].nodes.web.interrupted=true;return g;}
function scenario(){
 const params=new URLSearchParams(location.search),approved=params.get('layout')==='approved',online=params.get('online')==='1';
 let game=initial();let result:ReturnType<typeof describeAction>=null;
 if(approved){
  game=newGame(online?'online':'local',['Моя компания','Компания «Вектор»'],71);game.status='playing';game.ap=2;game.players.forEach(p=>p.ready=true);
  game.players[0].money=40;
  game.players[0].layout={control:4,workstation:6,service1:8,database:12,web:21,files:23,service2:0,service3:1};
  game.players[0].nodes.service1.built=true;game.players[0].hand=['ddos','patch','shield','optimize'];
  game.players[1].layout={control:4,workstation:20,database:17,files:24,web:7,service1:0,service2:1,service3:3};
  const scan:Action={type:'scan',cell:game.players[1].layout.web,side:'enemy'},before=viewGame(game,0);
  game=applyAction(game,0,scan);result=describeAction(before,scan,viewGame(game,0));
 }
 if(online){game.mode='online';if(params.get('pause')==='requested')game.pause={requestedBy:0,pausedAt:null};if(params.get('pause')==='agreed')game.pause={requestedBy:0,pausedAt:1_791_289_800_000};}
 return {game,result,approved,online,disconnected:params.get('connection')==='offline'};
}
const detailTitles:Record<TableDetail,string>={card:'О карте',node:'Об узле',log:'Журнал операции',finance:'Финансы компании',exchange:'Заменить карту',menu:'Меню матча',reserve:'Секретное дежурство',room:'Комната и связь',guide:'Ваш первый ход'};
function Fixture(){
 useLanguage();
 const [seed]=useState(scenario),[game,setGame]=useState(seed.game),[card,setCard]=useState<CardId|null>(null),[selection,setSelection]=useState<Selection|null>(seed.approved?null:{cell:7,side:'own'}),[side,setSide]=useState<Side>('own'),[category,setCategory]=useState<CardKind|'all'>('all'),[detail,setDetail]=useState<TableDetail|null>(null),[error,setError]=useState(''),[connected,setConnected]=useState(!seed.disconnected);
 const view=viewGame(game,0),me=view.players[0],feedback=useTurnFeedback(view,'fixture'),effect=useCardPlayEffect('fixture');
 const result=feedback.result??(game.serial===seed.game.serial&&game.turn===0?seed.result:null);
 const busy=seed.online&&!connected;
 const clear=()=>{setCard(null);setSelection(null);setDetail(null);setError('');};
 const pickCard=(id:CardId)=>{setCard(id);setDetail(null);setError('');if(CARDS[id].side==='none')setSelection(null);else{const next=CARDS[id].side as Side;setSide(next);if(selection?.side!==next)setSelection(null);}};
 const pickCell=(next:Selection)=>{if(card&&(CARDS[card].side==='none'||CARDS[card].side!==next.side))setCard(null);setSelection(next);setSide(next.side);setDetail(null);setError('');};
 const act=(action:Action,origin?:CardPlayOrigin)=>{
  try{
   const prepared=effect.prepare(action,view,origin),next=applyAction(game,0,action),after=viewGame(next,0);
   feedback.confirm(action,view,after);effect.confirm(prepared,after);setGame(next);setDetail(null);setError('');setCard(null);
   if(!['investigate','isolate','cleanse','restore'].includes(action.type))setSelection(null);
   if(action.type==='draw')setCategory('all');
  }catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
 };
 // Online fixture controls exercise presentation only; no remote seats are created.
 const pause=(decision:PauseDecision)=>setGame(current=>{const next=structuredClone(current);if(decision==='request')next.pause={requestedBy:0,pausedAt:null};else if(decision==='accept')next.pause={requestedBy:0,pausedAt:1_791_289_800_000};else delete next.pause;return next;});
 const selectedNode=selection?NODES.find(node=>view.players[selection.side==='own'?0:1].layout[node.id]===selection.cell):null;
 const title=detail==='card'&&card?CARDS[card].name:detail==='node'&&selectedNode?selectedNode.name:detail?detailTitles[detail]:'';
 const recovery=seed.online?<><ConnectionStatus info={{active:!game.pause?.pausedAt,reconnecting:!connected,opponentAway:false,graceMs:120_000,ownRemainingMs:90_000,opponentRemainingMs:120_000,canClaim:false}} onReconnect={()=>setConnected(true)}/><PauseStatus view={view} onPause={pause}/></>:null;
 return <div className="app-shell table-mode" data-qa-layout={seed.approved?'approved':'original'} data-qa-money={me.money} data-qa-ap={view.ap} data-qa-round={view.round}>
  <DuelTable view={view} card={card} selection={selection} side={side} category={category} busy={busy} online={seed.online} connection={connected?'Подключено':'Нет связи. Переподключаемся…'} opponentStatus="Соперник на связи" onCard={pickCard} onCell={pickCell} onSide={next=>{setSide(next);setSelection(null);if(card&&CARDS[card].side!==next&&CARDS[card].side!=='none')setCard(null);}} onCategory={next=>{setCategory(next);setCard(null);}} onAction={act} onEnd={()=>act({type:'end'})} onPause={()=>pause('request')} onDetails={setDetail} onClear={clear} feedback={<TurnFeedback summary={feedback.summary} result={result}/>} hasFeedback={!!result} recovery={recovery}/>
  <CardPlayEffect effect={effect.effect}/>
  {error&&<p role="alert" style={{position:'fixed',top:12,left:'50%',transform:'translateX(-50%)',zIndex:100,background:'#4b2424',padding:16}}>{t(error)}</p>}
  <Sheet open={!!detail} onOpenChange={open=>{if(!open)setDetail(null);}}><SheetContent side="bottom" className="inspect-sheet" data-qa-detail={detail??''}>
   <SheetTitle>{t(title)}</SheetTitle><SheetDescription>{t(detail==='room'?'Локальная QA-модель состояния связи; сетевые запросы не отправляются.':'Данные текущей партии и настоящие действия игрового движка.')}</SheetDescription>
   {detail==='card'&&card&&<><div style={{display:'flex',gap:24,alignItems:'center'}}><CardFace id={card}/><p>{t(CARDS[card].detail)}</p></div><button className="secondary-button" onClick={()=>setDetail('exchange')}>{t('Заменить бесплатно')}</button></>}
   {detail==='node'&&selectedNode&&selection&&<><p>{t(selectedNode.subtitle)}</p><p>{t(`Клетка ${coordinate(selection.cell)}`)}</p></>}
   {detail==='finance'&&<><p>{t(`Казна: ${me.money} кредитов`)}</p><p>{t(`Доход: ${incomeOf(me)} кредитов за раунд`)}</p></>}
   {detail==='log'&&<ol>{view.logs.map(entry=><li key={entry.id}>{t(entry.text)}</li>)}</ol>}
   {detail==='guide'&&<><p>{t('Перетащите карту сразу на подсвеченную цель и отпустите. Одинаковые карты собраны в стопки.')}</p><p>{t('Соперник → клетка → Разведать: 1 действие и 0 кредитов.')}</p></>}
   {detail==='menu'&&<><button className="primary-button" onClick={()=>{setGame(structuredClone(seed.game));setCategory('all');setSide('own');clear();}}>{t('Сбросить QA-партию')}</button><button className="secondary-button" onClick={()=>setDetail('guide')}>{t('Как сделать ход')}</button></>}
   {detail==='reserve'&&<div className="reserve-options">{(Object.keys(COUNTER_LABELS) as Countermeasure[]).map(counter=>{const action:Action={type:'reserve',counter},status=actionStatus(view,action);return <button key={counter} className="secondary-button" disabled={busy||!status.ok} title={t(status.reason||status.preview)} onClick={()=>act(action)}>{t(COUNTER_LABELS[counter])} · 30 ¤ · 1 ОД</button>;})}</div>}
   {detail==='exchange'&&card&&<div className="reserve-options">{(['attack','defense','economy'] as const).map(kind=>{const action:Action={type:'exchange',card,kind},status=actionStatus(view,action);return <button key={kind} className="secondary-button" disabled={busy||!status.ok} title={t(status.reason||status.preview)} onClick={()=>act(action)}>{t(kind==='attack'?'Атака':kind==='defense'?'Защита':'Экономика')}</button>;})}</div>}
   {detail==='room'&&<><p>{t(connected?'Подключено':'Нет связи. Переподключаемся…')}</p><button className="secondary-button" onClick={()=>setConnected(!connected)}>{t(connected?'Отключить связь (QA)':'Восстановить связь (QA)')}</button>{game.pause&&!game.pause.pausedAt&&<button className="primary-button" onClick={()=>{pause('accept');setDetail(null);}}>{t('Согласие второго игрока (QA)')}</button>}</>}
  </SheetContent></Sheet>
 </div>;
}
if(import.meta.env.DEV)createRoot(document.getElementById('root')!).render(<Fixture/>);
