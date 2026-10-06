/** Development-only visual fixture, never a production entry point. */
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DuelTable} from '../../components/game/tabletop';
import {type Selection} from '../../components/game/board';
import {newGame,applyAction,viewGame,type Action,type CardId,type CardKind,type Side} from '../../lib/game/engine';
import {useLanguage} from '../../lib/game/language';
import {TurnFeedback,useTurnFeedback} from '../../components/game/turn-feedback';
import {CardPlayEffect,useCardPlayEffect} from '../../components/game/card-play-effect';
import '../../app/globals.css';
import '../../components/game/tabletop.css';
import '../../components/game/desktop-table.css';
import '../../cloudflare/web/web.css';
function initial(){const g=newGame('local',['Моя компания','Компания «Вектор»'],71);g.status='playing';g.turn=0;g.ap=2;g.round=4;g.players.forEach(p=>p.ready=true);g.players[0].money=280;g.players[0].layout={...g.players[0].layout,web:7,workstation:22,database:12,files:4,control:15};g.players[1].layout={...g.players[1].layout,web:7,database:17};g.players[0].scanned=[7,17];g.players[1].reserve='ddos';g.players[0].hand=['ddos','optimize','shield','expand','patch'];g.players[0].nodes.web.offline=true;g.players[0].nodes.web.interrupted=true;return g;}
function Fixture(){useLanguage();const [game,setGame]=useState(initial),[card,setCard]=useState<CardId|null>(null),[selection,setSelection]=useState<Selection|null>({cell:7,side:'own'}),[side,setSide]=useState<Side>('own'),[category,setCategory]=useState<CardKind|'all'>('all');const view=viewGame(game,0),feedback=useTurnFeedback(view,'fixture'),effect=useCardPlayEffect('fixture');
 const act=(action:Action)=>{const prepared=effect.prepare(action,view),next=applyAction(game,0,action);feedback.confirm(action,view,viewGame(next,0));effect.confirm(prepared,viewGame(next,0));setGame(next);if(action.type==='card'){setCard(null);setSelection(null);}};
 return <div className="app-shell table-mode"><DuelTable view={view} card={card} selection={selection} side={side} category={category} busy={false} onCard={id=>{setCard(id);setSelection(null);}} onCell={setSelection} onSide={setSide} onCategory={setCategory} onAction={act} onEnd={()=>act({type:'end'})} onDetails={()=>{}} onClear={()=>{setCard(null);setSelection(null);}} feedback={<TurnFeedback summary={feedback.summary} result={feedback.result}/>} hasFeedback={!!feedback.result}/><CardPlayEffect effect={effect.effect}/></div>;
}
if(import.meta.env.DEV)createRoot(document.getElementById('root')!).render(<Fixture/>);
