import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,applyAction,viewGame,actionStatus,networkLinks,incomeOf,botAction} from '../lib/game/engine.ts';
import {visibleRoutes} from '../lib/game/visible-routes.ts';
import {trainingGame,trainingAction,trainingComplete} from '../lib/game/training.ts';
const fixture=(ruleset,actor=0)=>{
 const g=newGame('local',['A','B'],18,ruleset);g.status='playing';g.turn=actor;
 g.players.forEach(p=>{p.money=1000;p.ready=true;p.layout={web:0,workstation:4,database:20,files:24,control:12};p.scanned=[0,4,20,24,12];p.hand=['expand','recon','entry','pivot','operation','ddos','purge','backup'];for(const n of Object.values(p.nodes)){n.shield=0;n.auth=0;n.backup=false;n.sensor=false;}});return g;
};
const play=(g,a)=>applyAction(g,g.turn,a);
const end=g=>play(g,{type:'end'});
const card=(card,node,side='enemy')=>({type:'card',card,node,side});

test('baseline is default; experimental actions and forged profiles are rejected atomically',()=>{
 const g=fixture('baseline'),snapshot=JSON.stringify(g);
 for(const a of [{type:'contract',node:'web'},{type:'resolve'},{type:'route',from:'web',to:'database',closed:true},{type:'card',card:'expand',side:'own',cell:1,profile:'internal',parent:'control'},{type:'card',card:'expand',side:'own',cell:1,profile:'decoy'},{type:'card',card:'expand',side:'own',cell:1,profile:'constructor'}])assert.throws(()=>play(g,a));
 assert.equal(JSON.stringify(g),snapshot);assert.equal(newGame('bot').ruleset,'baseline');assert.throws(()=>newGame('bot',['A','B'],1,'all'));
});

test('A internal services require a real chosen route; public services trade greater income for entry',()=>{
 for(const actor of [0,1]){
  let g=fixture('services',actor);g=play(g,{type:'card',card:'expand',side:'own',cell:1,profile:'internal',parent:'files'});
  assert.equal(g.players[actor].nodes.service1.income,80);assert(networkLinks(g.players[actor]).some(([a,b])=>a==='files'&&b==='service1'));
  const enemy=1-actor;g.players[enemy].scanned.push(1);g.turn=enemy;g.ap=3;
  assert.equal(actionStatus(viewGame(g,enemy),card('entry','service1')).ok,false);
  assert.equal(actionStatus(viewGame(g,enemy),card('ddos','service1')).ok,false);
  g.players[actor].nodes.web.access=1;assert.equal(actionStatus(viewGame(g,enemy),card('pivot','service1')).ok,false);
  g.players[actor].nodes.files.access=1;g=play(g,card('pivot','service1'));assert.equal(g.players[actor].nodes.service1.access,1);
 }
 let g=play(fixture('services'),{type:'card',card:'expand',side:'own',cell:1});assert.equal(g.players[0].nodes.service1.income,120);
 g.players[1].scanned.push(1);g.turn=1;g.ap=3;assert.equal(actionStatus(viewGame(g,1),card('entry','service1')).ok,true);
});

test('dynamic parent and closed route are concealed until both endpoints are found',()=>{
 let g=play(fixture('services'),{type:'card',card:'expand',side:'own',cell:1,profile:'internal',parent:'files'});g.players[1].scanned=[1];
 const v=viewGame(g,1);assert.equal(v.players[0].nodes.service1.parent,undefined);assert.deepEqual(v.players[0].links,[]);
 assert.deepEqual(visibleRoutes(v,'enemy',{cell:1,side:'enemy'},null),[]);
 g=fixture('segmentation');g=play(g,{type:'route',from:'web',to:'database',closed:true});g.players[1].scanned=[0];assert.equal(viewGame(g,1).players[0].closedLink,null);
});

test('B requires two full rounds after acceptance for either initiative and cannot repeat a node',()=>{
 for(const actor of [0,1]){
  let g=fixture('contracts',actor);g=play(g,{type:'contract',node:'web'});assert.equal(g.players[actor].money,920);assert.equal(viewGame(g,1-actor).players[actor].contract.node,'web');
  assert.throws(()=>play(g,{type:'contract',node:'database'}));
  while(g.round===1)g=end(g);assert.equal(g.players[actor].contract.completedRounds,0);
  while(g.round===2)g=end(g);assert.equal(g.players[actor].contract.completedRounds,1);
  const previous=g.players[actor].money;while(g.round===3&&g.status==='playing')g=end(g);
  assert.equal(g.players[actor].contract.status,'completed');assert.equal(g.players[actor].money,previous+incomeOf(g.players[actor])+220);
  g.turn=actor;g.ap=3;assert.throws(()=>play(g,{type:'contract',node:'web'}));
 }
});

test('B publishes target coordinates, fails immediately on interruption and cannot be repaired into a reward',()=>{
 let g=fixture('contracts');g.players[1].scanned=[];g=play(g,{type:'contract',node:'web'});
 assert.equal(viewGame(g,1).players[0].layout.web,0);g=play(g,{type:'isolate',node:'web',side:'own'});assert.equal(g.players[0].contract.status,'failed');
 g=play(g,{type:'restore',node:'web',side:'own'});while(g.round<4)g=end(g);assert.equal(g.players[0].contract.status,'failed');
});

test('C closes exactly one real edge, retains service and access, and charges a business cost',()=>{
 let g=fixture('segmentation');g.players[0].nodes.web.access=1;const before=incomeOf(g.players[0]);
 g=play(g,{type:'route',from:'web',to:'database',closed:true});assert.equal(incomeOf(g.players[0]),before-20);assert.equal(g.players[0].nodes.web.access,1);assert.equal(g.players[0].nodes.web.offline,false);
 assert.throws(()=>play(g,{type:'route',from:'files',to:'control',closed:true}));assert.throws(()=>play(g,{type:'route',from:'web',to:'files',closed:false}));
 g.turn=1;g.ap=3;assert.equal(actionStatus(viewGame(g,1),card('pivot','database')).ok,false);
 const routes=visibleRoutes(viewGame(g,1),'enemy',{cell:0,side:'enemy'},'pivot');assert.equal(routes.find(r=>r.to==='database')?.state,'blocked');
 g.turn=0;g=play(g,{type:'route',from:'database',to:'web',closed:false});assert.equal(incomeOf(g.players[0]),before);g.turn=1;assert.equal(actionStatus(viewGame(g,1),card('pivot','database')).ok,true);
});

test('D cannot resolve in the same turn; signal exposes detection, cleanup cancels permanently',()=>{
 for(const actor of [0,1]){
  let g=fixture('preparation',actor);g.players[1-actor].nodes.web.access=1;const money=g.players[1-actor].money;
  g=play(g,card('operation','web'));assert.equal(g.players[1-actor].money,money);assert.equal(g.players[1-actor].nodes.web.detected,true);
  assert.equal(viewGame(g,1-actor).players[actor].prepared.node,'web');assert.throws(()=>play(g,{type:'resolve'}));
  g=end(g);g=play(g,{type:'cleanse',node:'web',side:'own'});assert.equal(g.players[actor].prepared,null);g=end(g);
  g=play(g,card('entry','web'));assert.throws(()=>play(g,{type:'resolve'}));
 }
});

test('D resolves once after defender turn; backup blocks; hidden reserve never changes preview',()=>{
 for(const backup of [false,true]){
  let g=fixture('preparation');g.players[1].nodes.web.access=1;g=play(g,card('operation','web'));g=end(g);
  if(backup)g=play(g,card('backup','web','own'));g=end(g);
  if(backup){assert.equal(g.players[0].prepared,null);continue;}
  const before=g.players[1].money;g=play(g,{type:'resolve'});assert.equal(g.players[1].money,before-200);assert.equal(g.players[1].nodes.web.offline,true);assert.equal(g.players[0].prepared,null);assert.throws(()=>play(g,{type:'resolve'}));
 }
 let g=fixture('preparation');g.players[1].nodes.web.access=1;g=play(g,card('operation','web'));g=end(end(g));
 const previews=['auth','backup','ddos'].map(reserve=>{const x=structuredClone(g);x.players[1].reserve=reserve;return actionStatus(viewGame(x,0),{type:'resolve'});});assert.deepEqual(previews[0],previews[1]);assert.deepEqual(previews[1],previews[2]);
 g.players[1].reserve='backup';const cash=g.players[1].money;g=play(g,{type:'resolve'});assert.equal(g.players[1].money,cash);assert.equal(g.players[1].nodes.web.access,0);
});

test('E has zero real income, one decoy limit and no eligibility oracle before entry',()=>{
 let g=play(fixture('decoy'),{type:'card',card:'expand',side:'own',cell:1,profile:'decoy'});g.players[0].hand.push('expand');assert.equal(g.players[0].nodes.service1.income,0);
 assert.throws(()=>play(g,{type:'card',card:'expand',side:'own',cell:2,profile:'decoy'}));
 g.turn=1;g.ap=3;g.players[1].scanned.push(1);const plain=structuredClone(g);plain.players[0].nodes.service1.profile='public';plain.players[0].nodes.service1.income=100;
 assert.deepEqual(viewGame(g,1).players[0].nodes,viewGame(plain,1).players[0].nodes);
 for(const c of ['entry','pivot','operation','ddos'])assert.deepEqual(actionStatus(viewGame(g,1),card(c,'service1')),actionStatus(viewGame(plain,1),card(c,'service1')));
 const cash=g.players[1].money;g=play(g,card('entry','service1'));assert.equal(g.players[1].money,cash-15);assert.equal(g.players[0].nodes.service1.access,0);assert.equal(viewGame(g,1).players[0].nodes.service1.profile,'decoy');assert.equal(g.players[1].hand.includes('entry'),false);
});

test('E thorough recon detects a decoy even in already scanned territory',()=>{
 let g=play(fixture('decoy'),{type:'card',card:'expand',side:'own',cell:1,profile:'decoy'});g.turn=1;g.ap=3;g.players[1].scanned=Array.from({length:25},(_,i)=>i);
 g=play(g,{type:'card',card:'recon',cell:1,side:'enemy'});assert.equal(viewGame(g,1).players[0].nodes.service1.profile,'decoy');
});

test('new summaries remain private during play and debrief is bounded to own facts at finish',()=>{
 let g=fixture('contracts');g=play(g,{type:'contract',node:'web'});g=play(g,{type:'isolate',node:'web',side:'own'});
 assert.equal(viewGame(g,1).episodes,undefined);assert.equal(viewGame(g,1).playtest,undefined);
 g=play(g,{type:'surrender'});const v=viewGame(g,0);assert(v.episodes.length<=4);assert(v.episodes.every(e=>e.owner===0));assert.equal(v.playtest[0].spending.economy,80);assert.equal(v.playtest[0].handAtFinish.expand,1);
 assert(!JSON.stringify(v.episodes).includes('гарант'));
});

test('experiments persist in a rematch; legacy saves without ruleset stay baseline',()=>{
 let g=fixture('contracts');g=play(g,{type:'surrender'});g=applyAction(g,0,{type:'rematch'});g=applyAction(g,1,{type:'rematch'});assert.equal(g.ruleset,'contracts');assert.equal(g.firstPlayer,1);assert.deepEqual(g.playtest[0].cards,{});
 const legacy=fixture('baseline');delete legacy.ruleset;delete legacy.playtest;delete legacy.episodes;assert.equal(viewGame(legacy,0).ruleset,'baseline');assert.equal(end(legacy).ruleset,undefined);
});

test('training has executable solutions and independent progress, with no free resets via forbidden actions',()=>{
 let g=trainingGame('response');g=trainingAction(g,{type:'cleanse',node:'workstation',side:'own'});assert(trainingComplete('response',g));
 g=trainingGame('response');g=trainingAction(g,{type:'isolate',node:'workstation',side:'own'});g=trainingAction(g,card('backup','workstation','own'));assert(trainingComplete('response',g));
 g=trainingGame('route');assert.throws(()=>trainingAction(g,card('entry','service1')));for(const [c,node] of [['entry','web'],['pivot','service1'],['operation','service1']])g=trainingAction(g,card(c,node));assert(trainingComplete('route',g));assert.throws(()=>trainingAction(g,{type:'end'}));
});

test('bots complete each isolated experiment with legal visible decisions',()=>{
 for(const rules of ['services','contracts','segmentation','preparation','decoy']){
  let g=fixture(rules);let steps=0;
  while(g.status==='playing'&&steps++<160){const action=botAction(viewGame(g,g.turn));assert(actionStatus(viewGame(g,g.turn),action).ok);g=play(g,action);}
  assert.equal(g.status,'finished',rules);
 }
});

test('baseline debrief distinguishes a prior response window from same-turn fraud',()=>{
 let g=fixture('baseline',1);g.players[0].nodes.workstation.access=1;g.players[0].nodes.workstation.detected=true;g.players[1].hand=['fraud'];
 const immediate=play(g,card('fraud','workstation'));assert.equal(immediate.episodes?.length,0);
 g=end(g);assert.equal(viewGame(g,0).accessWindows,undefined);g=end(g);g=play(g,card('fraud','workstation'));g=play(g,{type:'surrender'});
 assert(viewGame(g,0).episodes.some(e=>e.text.includes('до подмены платежа')));assert.equal(g.accessWindows['0:workstation'],undefined);
});
