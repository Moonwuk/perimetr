import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,applyAction,deploymentOf,viewGame,incomeOf,CARDS} from '../lib/game/engine.ts';
import {describeAction,summarizeTurn} from '../lib/game/action-feedback.ts';
const card=(card,node,side='enemy')=>({type:'card',card,node,side});
function ready(){let game=newGame('local',undefined,34);for(let actor=0;actor<2;actor++)game=applyAction(game,actor,{type:'deploy',deployment:deploymentOf(game.players[actor])});return game;}
function prepare(game,actor,cards){game.turn=actor;game.ap=3;game.players[actor].money=1000;game.players[actor].hand=[...cards];game.players[actor].scanned=Object.values(game.players[1-actor].layout);}
function act(game,action){const before=viewGame(game,game.turn),next=applyAction(game,game.turn,action),after=viewGame(next,before.viewer);return {next,before,after,result:describeAction(before,action,after)};}

test('DDoS reports actual treasury loss and separate lost round income, even when target is poor',()=>{
 const game=ready();prepare(game,0,['ddos']);game.players[1].nodes.web.shield=0;game.players[1].money=12;
 const {result}=act(game,card('ddos','web'));
 assert.match(result.title,/остановлен/);assert.equal(result.spent,CARDS.ddos.money);assert.equal(result.apSpent,1);assert.equal(result.blocked,false);
 assert.match(result.lines[0],/−12 ¤ из казны; −100 ¤ дохода/);assert.match(result.lines[1],/не вернёт/);
});

test('local protection and secret reserve report reflection rather than successful damage',()=>{
 for(const [attack,protection] of [['ddos','shield'],['operation','backup'],['phishing','auth'],['fraud','auth']])for(const reserved of [false,true]){
  const game=ready();prepare(game,0,[attack]);const node=attack==='phishing'||attack==='fraud'?'workstation':'web',n=game.players[1].nodes[node];
  n.shield=0;n.auth=0;n.backup=false;n.access=attack==='operation'||attack==='fraud'?1:0;
  if(reserved)game.players[1].reserve=protection==='shield'?'ddos':protection;
  else n[protection]=protection==='backup'?true:1;
  const {result}=act(game,card(attack,node));
  assert.equal(result.blocked,true,`${attack} reserve=${reserved}`);assert.equal(result.title,'Атака отражена');assert.match(result.lines[0],/сохранены/);assert.equal(result.spent,CARDS[attack].money);
 }
});

test('repair restores operation but does not invent recovered current-round income',()=>{
 const game=ready();prepare(game,0,['backup','patch']);game.players[0].nodes.web.offline=true;game.players[0].nodes.web.interrupted=true;
 for(const action of [{type:'restore',node:'web',side:'own'},card('backup','web','own'),card('patch','web','own')]){
  const {result,before,after}=act(game,action);
  assert.equal(incomeOf(before.players[0]),incomeOf(after.players[0]));assert.match(result.lines.join(' '),/100 ¤ за этот раунд уже потерян/);assert.match(result.lines.join(' '),/ремонт его не возвращает/);
  const summary=summarizeTurn(null,after);assert.equal(summary.expectedIncome,180);assert.equal(summary.nextRoundIncome,280);assert.equal(summary.lostIncome,100);
 }
});

test('fraud shows gross price, actual theft and net change independently',()=>{
 for(const balance of [0,5,80]){
  const game=ready();prepare(game,0,['fraud']);game.players[1].nodes.workstation.auth=0;game.players[1].nodes.workstation.access=1;game.players[1].money=balance;
  const {result}=act(game,card('fraud','workstation'));
  assert.equal(result.blocked,false);assert.equal(result.spent,CARDS.fraud.money);assert.equal(result.title,`Перехвачено ${balance} ¤`);
  if(!balance)assert.match(result.lines[0],/не было денег/);
 }
});

test('action feedback refuses unacknowledged, failed, wrong-viewer and finished transitions',()=>{
 const game=ready();prepare(game,0,['ddos']);const before=viewGame(game,0),move=card('ddos','web');
 assert.equal(describeAction(before,move,before),null);
 const after=viewGame(applyAction(game,0,move),0);assert.equal(describeAction(before,{type:'card',card:'operation',node:'database',side:'enemy'},after),null);
 assert.equal(describeAction(before,move,{...after,viewer:1}),null);assert.equal(describeAction(before,move,{...after,matchNumber:2}),null);
 assert.equal(describeAction(before,{type:'surrender'},viewGame(applyAction(game,0,{type:'surrender'}),0)),null);
 assert.equal(describeAction(before,{type:'end'},viewGame(applyAction(game,0,{type:'end'}),0)),null);
});

test('first own-turn briefing gives income without claiming knowledge of unseen intrusion',()=>{
 const game=ready(),clean=summarizeTurn(null,viewGame(game,0));game.players[0].nodes.web.access=2;game.players[0].nodes.web.detected=false;
 game.players[1].nodes.database.access=2;game.players[1].hand=['fraud'];game.logs.push({id:999,round:1,text:'PRIVATE SECRET ACCESS',audience:1,tone:'attack'});
 const hidden=summarizeTurn(null,viewGame(game,0));assert.deepEqual(hidden,clean);assert.equal(hidden.expectedIncome,280);assert.equal(hidden.problems.length,0);assert(!JSON.stringify(hidden).includes('PRIVATE'));
 assert.equal(summarizeTurn(null,viewGame(game,1)),null);game.status='finished';assert.equal(summarizeTurn(null,viewGame(game,0)),null);
});

test('next own turn summarizes visible damage, earned payout and remaining problems with bounds',()=>{
 let game=ready();prepare(game,1,['ddos','phishing']);game.players[0].nodes.web.shield=0;game.players[0].nodes.workstation.auth=0;
 const previous=viewGame(game,0);game=applyAction(game,1,card('ddos','web'));game=applyAction(game,1,card('phishing','workstation'));game=applyAction(game,1,{type:'end'});
 const summary=summarizeTurn(previous,viewGame(game,0));
 assert.equal(summary.expectedIncome,180);assert.equal(summary.lostIncome,100);assert(summary.changes.length<=3);assert(summary.problems.length<=3);
 assert.match(summary.changes.join(' '),/Из казны потеряно 50/);assert.match(summary.problems.join(' '),/отключён/);assert.match(summary.problems.join(' '),/обнаружен доступ/);
 const clone=structuredClone(game);clone.players[1].nodes.database.access=2;clone.logs.push({id:999,round:1,text:'enemy-private',audience:1,tone:'attack'});
 assert.deepEqual(summarizeTurn(previous,viewGame(clone,0)),summary);
});

test('basic actions, investigation, exchange and plan draws report distinct confirmed outcomes',()=>{
 let game=ready();prepare(game,0,['supply','recon','shield']);
 assert.match(act(game,{type:'scan',cell:0,side:'enemy'}).result.lines[0],/Открыто клеток/);
 assert.equal(act(game,{type:'draw'}).result.spent,0);assert.match(act(game,card('supply')).result.lines[0],/Получено карт: 2/);
 const exchange=act(game,{type:'exchange',card:'shield',kind:'economy'}).result;assert.equal(exchange.apSpent,0);assert.equal(exchange.spent,0);assert.match(exchange.title,/заменена/);
 game.players[0].nodes.web.access=1;game.players[0].nodes.web.detected=false;
 const investigated=act(game,{type:'investigate',node:'web',side:'own'});assert.equal(investigated.result.title,'Обнаружен чужой доступ');assert.match(investigated.result.lines.join(' '),/не удаляет доступ/);
 const reserve=act(game,{type:'reserve',counter:'ddos'}).result;assert.equal(reserve.spent,30);assert.match(reserve.lines[0],/Анти-DDoS/);
});

test('a supply draw has its own feedback id even when no journal entry was added',()=>{
 const game=ready();prepare(game,0,['stealth','supply']);
 const first=act(game,card('stealth')),second=act(first.next,card('supply'));
 assert.equal(first.after.serial,second.after.serial);assert.notEqual(first.result.id,second.result.id);assert.equal(second.result.apSpent,1);
 assert.match(second.result.lines[0],/Получено карт: 2/);
});
