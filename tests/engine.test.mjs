import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,applyAction,viewGame,actionStatus,cardReadiness,botAction,deploymentOf,scanArea,incomeOf,upgradeGame,CARDS,MONEY_GOAL,MAX_ROUNDS,BASE_INCOME,planAttacks} from '../lib/game/engine.ts';
const card=(card,node,side='enemy')=>({type:'card',card,node,side});
const end=g=>applyAction(g,g.turn,{type:'end'});
function ready(seed=12){let g=newGame('local',undefined,seed);for(let actor=0;actor<2;actor++)g=applyAction(g,actor,{type:'deploy',deployment:deploymentOf(g.players[actor])});return g;}
function prepare(g,actor,cards){g.players[actor].hand=[...cards];g.players[actor].money=1000;g.ap=3;g.turn=actor;}
function reveal(g,actor,id){const cell=g.players[1-actor].layout[id];if(!g.players[actor].scanned.includes(cell))g.players[actor].scanned.push(cell);}

test('setup validates a hidden, non-overlapping layout and four defense tokens',()=>{
 let g=newGame('local',undefined,123);assert.deepEqual(g.players[0].hand,g.players[1].hand);assert.deepEqual(g.players[0].deck,g.players[1].deck);
 assert.equal(g.players[0].hand.length,6);assert(g.players[0].hand.some(c=>CARDS[c].kind==='defense'));assert(g.players[0].hand.includes('expand'));
 const d=deploymentOf(g.players[0]);assert.throws(()=>applyAction(g,0,{type:'deploy',deployment:{...d,layout:[0,0,1,2,3]}}),/разным/);
 assert.throws(()=>applyAction(g,0,{type:'deploy',deployment:{...d,shields:[2,2,2,2,2]}}),/четыре/);
 assert.throws(()=>applyAction(g,0,{type:'end'}),/не идёт/);
 g=applyAction(g,0,{type:'deploy',deployment:d});assert.equal(g.turn,1);assert.equal(g.status,'setup');
 assert.deepEqual(viewGame(g,1).players[0].layout,{});
 g=applyAction(g,1,{type:'deploy',deployment:deploymentOf(g.players[1])});assert.equal(g.status,'playing');assert.equal(g.turn,0);
 g=end(g);assert.equal(g.players[1].hand.length,6);g=end(g);assert.equal(g.players[0].hand.length,8);g=end(g);assert.equal(g.players[1].hand.length,8);
});

test('grid scouting reveals only the selected area; secrets and private logs stay hidden',()=>{
 let g=ready();g.players[0].hand.push('entry');g.players[1].layout={web:12,workstation:24,database:0,files:4,control:20};
 g.players[1].nodes.web.shield=0;g.players[1].nodes.web.sensor=false;
 const initial=viewGame(g,0);assert.deepEqual(initial.players[1].layout,{});assert(Object.values(initial.players[1].nodes).every(n=>n===null));
 g=applyAction(g,0,{type:'card',card:'recon',cell:12,side:'enemy'});assert.deepEqual(g.players[0].scanned,scanArea(12,true));
 assert.deepEqual(viewGame(g,0).players[1].layout,{web:12});assert.equal(g.players[0].money,280);
 g=applyAction(g,0,card('entry','web'));assert.equal(g.players[1].nodes.web.access,1);
 const opponent=viewGame(g,1);assert.equal(opponent.players[1].nodes.web.access,0);assert.deepEqual(opponent.players[0].hand,[]);
 assert(!('deck' in opponent.players[0]));assert(!('discard' in opponent.players[0]));assert(!('rng' in opponent));assert(!opponent.logs.some(l=>l.text.includes('Доступ получен')));
 g=end(g);g=applyAction(g,1,{type:'investigate',node:'web',side:'own'});assert.equal(viewGame(g,1).players[1].nodes.web.access,1);
 assert.deepEqual(scanArea(0),[0,1,5]);assert.deepEqual(scanArea(0,true),[0,1,5,6]);
});

test('invalid actions are atomic, charge both resources only on success, and use public eligibility',()=>{
 let g=ready();const snapshot=JSON.stringify(g);
 for(const action of [card('operation','database'),card('__proto__','web'),{type:'scan',cell:99,side:'enemy'},{type:'scan',cell:12,side:'own'}]){
  assert.equal(actionStatus(viewGame(g,0),action).ok,false);assert.throws(()=>applyAction(g,0,action));assert.equal(JSON.stringify(g),snapshot);
 }
 assert.throws(()=>applyAction(g,1,{type:'end'}),/ход соперника/);
 g.players[0].money=19;assert.throws(()=>applyAction(g,0,{type:'card',card:'recon',cell:12,side:'enemy'}),/кредитов/);
 g.players[0].money=20;g=applyAction(g,0,{type:'card',card:'recon',cell:12,side:'enemy'});assert.equal(g.players[0].money,0);assert.equal(g.ap,2);assert(!g.players[0].hand.includes('recon'));
 assert.equal(actionStatus(viewGame(g,0),{type:'scan',cell:12,side:'enemy'}).ok,false);
});

test('isolation blocks routes without erasing access; repair cannot refund lost income',()=>{
 let g=ready();const n=g.players[0].nodes.web;n.access=2;n.detected=true;
 g=applyAction(g,0,{type:'isolate',node:'web',side:'own'});assert.equal(g.players[0].nodes.web.access,2);
 assert.equal(incomeOf(g.players[0]),180);g=applyAction(g,0,{type:'restore',node:'web',side:'own'});
 assert.equal(g.players[0].nodes.web.access,2);assert.equal(incomeOf(g.players[0]),180);
 g=end(end(g));assert.equal(g.players[0].money,480);assert.equal(g.players[1].money,580);assert.equal(incomeOf(g.players[0]),280);
 g=applyAction(g,0,{type:'cleanse',node:'web',side:'own'});assert.equal(g.players[0].nodes.web.access,0);assert.equal(g.ap,2);
 const h=ready();h.players[0].nodes.web.access=2;assert.throws(()=>applyAction(h,0,{type:'cleanse',node:'web',side:'own'}),/обнаружьте/);
});

test('pivot requires a discovered, connected and live source; anti-DDoS does not stop entry',()=>{
 let g=ready();prepare(g,0,['pivot','entry','escalate']);reveal(g,0,'files');reveal(g,0,'web');reveal(g,0,'workstation');
 g.players[1].nodes.web.access=1;assert.throws(()=>applyAction(g,0,card('pivot','files')),/связанному/);
 g.players[1].nodes.workstation.access=1;g.players[1].nodes.workstation.offline=true;
 assert.throws(()=>applyAction(g,0,card('pivot','files')),/связанному/);assert.throws(()=>applyAction(g,0,card('escalate','workstation')),/отключён/);
 g.players[1].nodes.workstation.offline=false;g=applyAction(g,0,card('pivot','files'));assert.equal(g.players[1].nodes.files.access,1);
 g.players[1].nodes.web.access=0;g.players[1].nodes.web.shield=1;g=applyAction(g,0,card('entry','web'));assert.equal(g.players[1].nodes.web.shield,1);assert.equal(g.players[1].nodes.web.access,1);
});

test('quiet access avoids one sensor alert; patch keeps intrusion and backup removes it',()=>{
 let g=ready();prepare(g,0,['stealth','entry','escalate']);reveal(g,0,'web');g.players[1].nodes.web.shield=0;g.players[1].nodes.web.sensor=true;
 g=applyAction(g,0,{type:'card',card:'stealth'});g=applyAction(g,0,card('entry','web'));assert.equal(g.players[1].nodes.web.detected,false);
 g=applyAction(g,0,card('escalate','web'));assert.equal(g.players[1].nodes.web.detected,true);assert.equal(g.players[0].quiet,false);
 g=end(g);prepare(g,1,['patch','backup']);g.players[1].nodes.web.offline=true;
 g=applyAction(g,1,card('patch','web','own'));assert.equal(g.players[1].nodes.web.access,2);assert.equal(g.players[1].nodes.web.offline,false);
 g=applyAction(g,1,card('backup','web','own'));assert.equal(g.players[1].nodes.web.access,0);assert.equal(g.players[1].nodes.web.detected,false);
});

test('new servers cost money, occupy new cells, increase income and are attackable',()=>{
 let g=ready();prepare(g,0,['expand','expand','expand','expand','optimize','optimize','optimize']);
 for(let i=1;i<=3;i++){
  const free=Array.from({length:25},(_,i)=>i).find(c=>!Object.values(g.players[0].layout).includes(c));
  g=applyAction(g,0,{type:'card',card:'expand',side:'own',cell:free});assert.equal(g.players[0].nodes[`service${i}`].built,true);
  assert.equal(incomeOf(g.players[0]),280+i*100);
 }
 assert.equal(g.players[0].money,280);g.ap=3;assert.throws(()=>applyAction(g,0,{type:'card',card:'expand',side:'own',cell:g.players[0].layout.web}),/занята/);
 const free=Array.from({length:25},(_,i)=>i).find(c=>!Object.values(g.players[0].layout).includes(c));assert.throws(()=>applyAction(g,0,{type:'card',card:'expand',side:'own',cell:free}),/три/);
 g=applyAction(g,0,card('optimize','service1','own'));g=applyAction(g,0,card('optimize','service1','own'));assert.equal(g.players[0].nodes.service1.income,180);
 g.players[0].money=120;assert.throws(()=>applyAction(g,0,card('optimize','service1','own')),/максимума/);
 reveal(g,1,'service1');prepare(g,1,['ddos']);g=applyAction(g,1,card('ddos','service1'));assert.equal(g.players[0].nodes.service1.offline,true);
});

test('DDoS, current-round loss and next-round repair are symmetric for either seat',()=>{
 for(let actor=0;actor<2;actor++){
  let g=ready();prepare(g,actor,['ddos','ddos']);const victim=1-actor;reveal(g,actor,'web');
  g.players[victim].nodes.web.shield=1;g=applyAction(g,actor,card('ddos','web'));assert.equal(g.players[victim].nodes.web.offline,false);
  g=applyAction(g,actor,card('ddos','web'));assert.equal(incomeOf(g.players[victim]),180);
  while(g.round===1)g=end(g);
  assert.equal(g.players[victim].money,430);g.turn=victim;g.ap=3;g=applyAction(g,victim,{type:'restore',node:'web',side:'own'});
  assert.equal(incomeOf(g.players[victim]),280);
 }
});

test('sabotage only damages income servers, needs access and cannot repeat without a new intrusion',()=>{
 let g=ready();prepare(g,0,['operation','operation']);reveal(g,0,'web');
 assert.throws(()=>applyAction(g,0,card('operation','web')),/получите доступ/);g.players[1].nodes.web.access=1;g.players[1].money=35;
 g=applyAction(g,0,card('operation','web'));assert.equal(g.players[1].money,0);assert.equal(g.players[0].money,1000-CARDS.operation.money);assert(g.players[1].nodes.web.offline);assert.equal(g.players[1].nodes.web.access,0);
 g.ap=3;assert.throws(()=>applyAction(g,0,card('operation','web')),/отключён/);
 reveal(g,0,'control');g.players[1].nodes.control.access=1;assert.throws(()=>applyAction(g,0,card('operation','control')),/доходном сервере/);
});

test('victory resolves after both turns; base contracts and free repair prevent a dead end',()=>{
 let g=ready();g.players[0].money=MONEY_GOAL-100;g.players[1].money=MONEY_GOAL-100;
 g=end(g);assert.equal(g.status,'playing');g=end(g);assert.equal(g.status,'finished');assert.equal(g.winner,null);
 g=ready();g.players[0].money=0;for(const n of Object.values(g.players[0].nodes)){n.offline=true;n.interrupted=true;}
 assert.equal(incomeOf(g.players[0]),BASE_INCOME);g=applyAction(g,0,{type:'restore',node:'web',side:'own'});assert.equal(g.players[0].money,0);
 g=end(end(g));assert.equal(g.players[0].money,40);assert.equal(incomeOf(g.players[0]),140);
 g=ready();g.round=MAX_ROUNDS;g=end(end(g));assert.equal(g.status,'finished');
});

test('discard reshuffles, empty piles reject a paid draw, surrender works off turn',()=>{
 let g=ready();g.players[0].hand=[];g.players[0].deck=[];g.players[0].discard=['entry','recon'];
 g=applyAction(g,0,{type:'draw'});assert.equal(g.players[0].hand.length,1);assert.equal(g.ap,2);assert.equal(g.players[0].discard.length,0);
 g.players[0].deck=[];assert.throws(()=>applyAction(g,0,{type:'draw'}),/Нет карт/);
 g=applyAction(g,1,{type:'surrender'});assert.equal(g.status,'finished');assert.equal(g.winner,0);assert.equal(Object.keys(CARDS).length,18);
});

test('legacy rooms preserve hands and access while gaining new economic fields',()=>{
 const old=ready();old.version=1;old.players.forEach(p=>{p.score=4;delete p.money;delete p.layout;delete p.scanned;delete p.ready;p.intel=['web'];for(const id of ['service1','service2','service3'])delete p.nodes[id];});
 old.players[1].nodes.web.access=2;const updated=upgradeGame(old);assert.equal(updated.version,5);assert.equal(updated.players[0].money,500);assert.equal(updated.players[1].nodes.web.access,2);
 assert.deepEqual(updated.players[0].hand,old.players[0].hand);assert.equal(viewGame(updated,0).players[1].layout.web,0);assert.equal(old.version,1);
});

test('bot sees only public information and simulated duels stay legal and finish',()=>{
 const a=ready(77),b=structuredClone(a);b.players[1].layout={web:0,workstation:1,database:2,files:3,control:4};b.players[1].hand=['ddos'];
 // Keep public counts identical; only the private card identities and hidden locations differ.
 b.players[1].hand=Array(a.players[1].hand.length).fill('ddos');assert.deepEqual(viewGame(a,0),viewGame(b,0));assert.deepEqual(botAction(a),botAction(b));
 for(let seed=1;seed<=60;seed++){
  let g=ready(seed),actions=0;
  while(g.status==='playing'&&actions<MAX_ROUNDS*10){const action=g.ap===0?{type:'end'}:botAction(g);assert(actionStatus(viewGame(g,g.turn),action).ok);g=applyAction(g,g.turn,action);actions++;
   assert(g.ap>=0&&g.ap<=3);for(const p of g.players){assert(p.money>=0);assert(p.hand.length<=10);assert.equal(new Set(Object.values(p.layout)).size,Object.values(p.layout).length);for(const n of Object.values(p.nodes)){assert(n.shield>=0&&n.shield<=2);assert(n.auth>=0&&n.auth<=2);assert.equal(typeof n.backup,'boolean');assert(n.access>=0&&n.access<=2);}}}
  assert.equal(g.status,'finished');assert(g.round<=MAX_ROUNDS);
 }
});

test('new games start with two cards of each kind; draws alternate while alternatives exist',()=>{
 for(let seed=1;seed<=40;seed++){
  const g=newGame('local',undefined,seed),p=g.players[0];
  for(const kind of ['attack','defense','economy']){assert.equal(p.hand.filter(c=>CARDS[c].kind===kind).length,2);assert.equal(p.deck.filter(c=>CARDS[c].kind===kind).length,12);}
  assert.deepEqual(p.hand,g.players[1].hand);assert.deepEqual(p.deck,g.players[1].deck);
  for(let i=1;i<p.deck.length;i++)assert.notEqual(CARDS[p.deck[i-1]].kind,CARDS[p.deck[i]].kind);
 }
 let g=ready();g.players[0].hand=[];g.players[0].deck=['entry','operation','escalate','shield','expand'];
 for(let i=0;i<3;i++)g=applyAction(g,0,{type:'draw'});
 assert.deepEqual(g.players[0].hand,['entry','shield','expand']);
});

test('a full hand of unusable attacks can exchange into a playable economy card without spending',()=>{
 let g=ready();g.players[0].hand=Array(10).fill('operation');g.players[0].deck=['operation','expand','shield'];
 const before=viewGame(g,0);assert.equal(cardReadiness(before,'operation').label,'Нужна разведка');assert.equal(actionStatus(before,{type:'draw'}).ok,false);
 g=applyAction(g,0,{type:'exchange',card:'operation',kind:'economy'});
 assert.equal(g.players[0].hand.length,10);assert.equal(g.players[0].hand.filter(c=>c==='operation').length,9);assert(g.players[0].hand.includes('expand'));
 assert.equal(g.ap,3);assert.equal(g.players[0].money,300);assert.equal(cardReadiness(viewGame(g,0),'expand').ok,true);
 assert.throws(()=>applyAction(g,0,{type:'exchange',card:'operation',kind:'defense'}),/уже использована/);
 const free=Array.from({length:25},(_,i)=>i).find(c=>!Object.values(g.players[0].layout).includes(c));
 g=applyAction(g,0,{type:'card',card:'expand',cell:free,side:'own'});assert.equal(incomeOf(g.players[0]),380);
 assert.deepEqual(viewGame(g,1).players[0].exchangeOptions,{});assert(!viewGame(g,1).logs.some(l=>l.text.startsWith('Замена:')));
 g=end(end(g));assert.equal(g.round,2);assert.equal(actionStatus(viewGame(g,0),{type:'exchange',card:'operation',kind:'economy'}).ok,true);
});

test('exchange rejects the same card and absent categories atomically, works with no AP or cash',()=>{
 let g=ready();g.players[0].hand=['recon'];g.players[0].deck=['recon'];g.players[0].discard=['shield'];g.players[0].money=0;g.ap=0;
 const snapshot=JSON.stringify(g);
 for(const action of [{type:'exchange',card:'recon',kind:'attack'},{type:'exchange',card:'__proto__',kind:'economy'},{type:'exchange',card:'recon',kind:'__proto__'}]){assert.throws(()=>applyAction(g,0,action));assert.equal(JSON.stringify(g),snapshot);}
 g=applyAction(g,0,{type:'exchange',card:'recon',kind:'defense'});assert.deepEqual(g.players[0].hand,['shield']);assert.equal(g.ap,0);assert.equal(g.players[0].money,0);assert.deepEqual(g.players[0].discard,['recon']);
 assert.throws(()=>applyAction(g,1,{type:'exchange',card:g.players[1].hand[0],kind:'defense'}),/ход соперника/);
});

test('card readiness explains missing prerequisites and agrees with playable attacks',()=>{
 let g=ready();prepare(g,0,['entry','escalate','operation']);reveal(g,0,'web');g.players[1].nodes.web.shield=0;
 assert.equal(cardReadiness(viewGame(g,0),'entry').ok,true);assert.equal(cardReadiness(viewGame(g,0),'escalate').label,'Нужен доступ');assert.equal(cardReadiness(viewGame(g,0),'operation').label,'Нужен доступ');
 g=applyAction(g,0,card('entry','web'));assert.equal(cardReadiness(viewGame(g,0),'escalate').ok,true);
 g=applyAction(g,0,card('escalate','web'));g.ap=2;assert.equal(cardReadiness(viewGame(g,0),'operation').ok,true);
 g.players[1].nodes.web.offline=true;assert.equal(cardReadiness(viewGame(g,0),'operation').ok,false);
});


test('specialized counters block their matching attack only, symmetrically for both seats',()=>{
 const protections=['shield','auth','backup'];
 for(const actor of [0,1])for(const attack of ['ddos','phishing','operation','fraud'])for(const guard of protections){
  const node=attack==='phishing'||attack==='fraud'?'workstation':'web';
  let g=ready();prepare(g,actor,[attack]);reveal(g,actor,node);const victim=1-actor;
  Object.assign(g.players[victim].nodes[node],{shield:0,auth:0,backup:false,sensor:false,access:attack==='operation'||attack==='fraud'?1:0});
  g.players[victim].nodes[node][guard]=guard==='backup'?true:1;
  const protectedHit=guard==={ddos:'shield',phishing:'auth',operation:'backup',fraud:'auth'}[attack];
  const preview=actionStatus(viewGame(g,actor),card(attack,node));assert.equal(preview.ok,true);
  if(protectedHit)assert.match(preview.preview,/отразит/);
  g=applyAction(g,actor,card(attack,node));const n=g.players[victim].nodes[node];
  if(protectedHit){
   assert.equal(g.players[victim].money,300);assert.equal(incomeOf(g.players[victim]),280);assert.equal(n.offline,false);assert.equal(n.access,0);assert.equal(n[guard],guard==='backup'?false:0);
   assert.equal(g.players[actor].money,1000-CARDS[attack].money);
  }else{
   assert.equal(n[guard],guard==='backup'?true:1);
   const loss={ddos:50,phishing:0,operation:100,fraud:80}[attack];
   assert.equal(g.players[victim].money,300-loss);
   assert.equal(g.players[actor].money,1000-CARDS[attack].money+(attack==='fraud'?80:0));
   assert.equal(n.offline,attack==='ddos'||attack==='operation');assert.equal(incomeOf(g.players[victim]),attack==='phishing'||attack==='fraud'?280:180);
  }
  assert.equal(g.ap,2);assert.equal(g.players[actor].hand.length,0);
 }
});

test('sabotage is a two-card chain; admin is an optional damage upgrade and backup breaks access',()=>{
 let g=ready();prepare(g,0,['entry','operation']);reveal(g,0,'web');
 g=applyAction(g,0,card('entry','web'));assert.equal(cardReadiness(viewGame(g,0),'operation').ok,true);
 g=applyAction(g,0,card('operation','web'));assert.equal(g.ap,1);assert.equal(g.players[1].money,200);assert.equal(incomeOf(g.players[1]),180);
 g=ready();prepare(g,0,['entry','escalate','operation']);reveal(g,0,'web');
 for(const c of ['entry','escalate','operation'])g=applyAction(g,0,card(c,'web'));
 assert.equal(g.ap,0);assert.equal(g.players[1].money,150);
 g=ready();prepare(g,0,['operation','operation']);reveal(g,0,'database');g.players[1].nodes.database.access=2;
 assert.equal(cardReadiness(viewGame(g,0),'operation').label,'Есть контрмера');
 g=applyAction(g,0,card('operation','database'));assert.equal(g.players[1].nodes.database.backup,false);assert.equal(g.players[1].nodes.database.access,0);
 assert.throws(()=>applyAction(g,0,card('operation','database')),/получите доступ/);
});

test('phishing only enters account surfaces, never steals money and allows a one-action response',()=>{
 for(const actor of [0,1])for(const node of ['workstation','control']){
  let g=ready();prepare(g,actor,['phishing','phishing']);const victim=1-actor;reveal(g,actor,node);g.players[victim].money=25;g.players[victim].nodes[node].auth=0;
  g=applyAction(g,actor,card('phishing',node));assert.equal(g.players[victim].money,25);assert.equal(g.players[actor].money,985);assert.equal(g.players[victim].nodes[node].access,1);assert.equal(viewGame(g,victim).players[victim].nodes[node].access,1);
  const snapshot=JSON.stringify(g);assert.throws(()=>applyAction(g,actor,card('phishing',node)),/Повторный фишинг/);assert.equal(JSON.stringify(g),snapshot);
  g=end(g);g=applyAction(g,victim,{type:'cleanse',node,side:'own'});assert.equal(g.ap,2);assert.equal(g.players[victim].nodes[node].access,0);
 }
 let g=ready();prepare(g,0,['phishing']);for(const node of ['web','database','files']){reveal(g,0,node);assert.throws(()=>applyAction(g,0,card('phishing',node)),/нацелен на сотрудника/);}
});

test('payment fraud requires workstation access, caps theft, consumes access and cannot farm or overdraw',()=>{
 for(const cash of [0,25,300])for(const access of [1,2]){
  let g=ready();prepare(g,0,['fraud','fraud']);reveal(g,0,'workstation');g.players[1].nodes.workstation.auth=0;g.players[1].money=cash;
  assert.throws(()=>applyAction(g,0,card('fraud','workstation')),/получите доступ/);g.players[1].nodes.workstation.access=access;
  g=applyAction(g,0,card('fraud','workstation'));const stolen=Math.min(80,cash);assert.equal(g.players[1].money,cash-stolen);assert.equal(g.players[0].money,965+stolen);assert.equal(g.players[1].nodes.workstation.access,0);assert.equal(g.players[1].nodes.workstation.offline,false);assert.equal(g.stats[0].stolen,stolen);
  assert.throws(()=>applyAction(g,0,card('fraud','workstation')),/получите доступ/);
 }
 const g=ready();prepare(g,0,['fraud']);reveal(g,0,'control');g.players[1].nodes.control.access=2;assert.throws(()=>applyAction(g,0,card('fraud','control')),/рабочей станции/);
});

test('specialized setup respects a shared budget and scouting reveals counters without other secrets',()=>{
 let g=newGame('local',undefined,99);const d={layout:[0,4,20,24,12],shields:[1,0,0,0,0],auth:[0,1,0,0,0],backups:[0,0,1,0,0],sensors:[1,0,0,0,0]};
 for(const auth of [[-1,0,0,0,0],[3,0,0,0,0],[1,1,0,0,0]])assert.throws(()=>applyAction(g,0,{type:'deploy',deployment:{...d,auth}}));
 g=applyAction(g,0,{type:'deploy',deployment:d});g=applyAction(g,1,{type:'deploy',deployment:d});
 assert.equal(viewGame(g,0).players[1].nodes.database,null);
 g=applyAction(g,0,{type:'scan',side:'enemy',cell:20});
 assert.equal(viewGame(g,0).players[1].nodes.database.backup,true);assert.equal(viewGame(g,0).players[1].nodes.web,null);
 assert(g.logs.some(l=>l.audience===0&&l.text.includes('Восстановление: готово')));assert(!viewGame(g,1).logs.some(l=>l.text.includes('Восстановление: готово')));
});

test('backup repairs and prepares a counter but cannot refund already lost income or cash',()=>{
 let g=ready();prepare(g,0,['backup']);g.players[0].nodes.web.offline=true;g.players[0].nodes.web.interrupted=true;g.players[0].nodes.web.access=1;g.players[0].nodes.web.detected=true;
 g=applyAction(g,0,card('backup','web','own'));assert.equal(g.players[0].nodes.web.backup,true);assert.equal(g.players[0].nodes.web.access,0);assert.equal(g.players[0].nodes.web.offline,false);assert.equal(incomeOf(g.players[0]),180);assert.equal(g.players[0].money,1000-CARDS.backup.money);
});

test('v2 migration preserves saved rooms and is idempotent without granting free counters',()=>{
 const old=ready();old.version=2;old.players[0].money=731;old.players[1].nodes.web.access=2;
 for(const p of old.players)for(const n of Object.values(p.nodes)){delete n.auth;delete n.backup;}
 const snapshot=JSON.stringify(old),up=upgradeGame(old);assert.equal(up.version,5);assert.equal(up.players[0].money,731);assert.equal(up.players[1].nodes.web.access,2);
 assert.deepEqual(up.players[0].layout,old.players[0].layout);assert.deepEqual(up.players[0].hand,old.players[0].hand);assert.equal(up.players[1].nodes.web.auth,0);assert.equal(up.players[1].nodes.web.backup,false);
 assert.equal(JSON.stringify(old),snapshot);assert.deepEqual(upgradeGame(up),up);
});

test('secret reserve has the same visible projection for every chosen type and no hidden preview oracle',()=>{
 const views=[];for(const counter of ['ddos','auth','backup']){let g=ready();g=applyAction(g,0,{type:'reserve',counter});assert.equal(g.players[0].money,270);assert.equal(g.ap,2);assert.throws(()=>applyAction(g,0,{type:'reserve',counter}),/уже/);g=end(g);reveal(g,1,'web');g.players[1].hand=['ddos'];const v=viewGame(g,1);assert.equal(v.players[0].reserve,'hidden');assert.equal(v.stats,undefined);assert(!v.logs.some(l=>l.text.startsWith('Дежурство:')));views.push({v,status:actionStatus(v,card('ddos','web'))});}
 assert.deepEqual(views[0],views[1]);assert.deepEqual(views[1],views[2]);
});

test('reserve protects one matching attack across the network, local guards first, and persists between turns',()=>{
 for(const victim of [0,1])for(const attack of ['ddos','phishing','operation','fraud'])for(const counter of ['ddos','auth','backup']){
  const node=attack==='phishing'||attack==='fraud'?'workstation':'web';
  let g=ready();g.turn=victim;g=applyAction(g,victim,{type:'reserve',counter});g=end(g);const actor=1-victim;prepare(g,actor,[attack]);reveal(g,actor,node);Object.assign(g.players[victim].nodes[node],{shield:0,auth:0,backup:false,access:attack==='operation'||attack==='fraud'?1:0});
  const before=g.players[victim].money;g=applyAction(g,actor,card(attack,node));const match=counter==={ddos:'ddos',phishing:'auth',operation:'backup',fraud:'auth'}[attack];
  assert.equal(g.players[victim].reserve,match?null:counter);assert.equal(g.players[victim].nodes[node].offline,!match&&(attack==='operation'||attack==='ddos'));assert.equal(g.stats[victim].blocked,match?1:0);if(match){assert.equal(g.players[victim].money,before);assert.equal(g.players[victim].nodes[node].access,0);}
 }
 let g=ready();g=applyAction(g,0,{type:'reserve',counter:'ddos'});g=end(g);prepare(g,1,['ddos']);reveal(g,1,'web');g=applyAction(g,1,card('ddos','web'));assert.equal(g.players[0].nodes.web.shield,0);assert.equal(g.players[0].reserve,'ddos');g=end(g);assert.equal(g.players[0].reserve,'ddos');assert.equal(actionStatus(viewGame(g,0),{type:'reserve',counter:'ddos'}).ok,false);
 const money=g.players[0].money;g=applyAction(g,0,{type:'reserve',counter:'auth'});assert.equal(g.players[0].money,money-30);assert.equal(g.players[0].reserve,'auth');assert.equal(g.ap,2);assert.throws(()=>applyAction(g,0,{type:'reserve',counter:'backup'}),/уже выбрано/);
});

test('successful sabotage burns access and cannot be repeated after mere repair',()=>{
 let g=ready();prepare(g,0,['entry','operation']);reveal(g,0,'web');g=applyAction(g,0,card('entry','web'));g=applyAction(g,0,card('operation','web'));assert.equal(g.players[1].nodes.web.access,0);g=end(g);g=applyAction(g,1,{type:'restore',node:'web',side:'own'});g=end(g);g.players[0].hand=['operation'];assert.equal(actionStatus(viewGame(g,0),card('operation','web')).ok,false);
});

test('two consenting players start rematch with alternating initiative and income after both turns only',()=>{
 let g=ready();g=applyAction(g,0,{type:'surrender'});g=applyAction(g,0,{type:'rematch'});assert.equal(g.status,'finished');assert.throws(()=>applyAction(g,0,{type:'rematch'}),/уже готовы/);g=applyAction(g,1,{type:'rematch'});assert.equal(g.matchNumber,2);assert.equal(g.firstPlayer,1);assert.equal(g.status,'setup');for(const actor of [0,1])g=applyAction(g,actor,{type:'deploy',deployment:deploymentOf(g.players[actor])});assert.equal(g.turn,1);assert.deepEqual(g.players.map(p=>p.money),[300,300]);g=end(g);assert.equal(g.turn,0);assert.equal(g.round,1);assert.deepEqual(g.players.map(p=>p.money),[300,300]);g=end(g);assert.equal(g.turn,1);assert.equal(g.round,2);assert.deepEqual(g.players.map(p=>p.money),[580,580]);assert.deepEqual(g.stats.map(s=>s.spent),[0,0]);
});

test('v3 migration adds reserve and match metadata without revealing either hand or changing progress',()=>{
 const old=ready();old.version=3;delete old.stats;delete old.firstPlayer;delete old.matchNumber;delete old.rematchVotes;for(const p of old.players){delete p.reserve;delete p.reserveRound;}const g=upgradeGame(old);assert.equal(g.version,5);assert.equal(g.firstPlayer,0);assert.equal(g.players[0].reserve,null);assert.deepEqual(g.players[0].hand,old.players[0].hand);assert.equal(viewGame(g,1).stats,undefined);
});

test('discovering an internal server does not make it DDoS reachable; real access is required',()=>{
 for(const actor of [0,1])for(const node of ['database','files']){
  let g=ready();prepare(g,actor,['ddos']);const victim=1-actor;reveal(g,actor,node);
  const snapshot=JSON.stringify(g);assert.throws(()=>applyAction(g,actor,card('ddos',node)),/внутренний узел/);assert.equal(JSON.stringify(g),snapshot);
  g.players[victim].nodes[node].access=1;assert.equal(actionStatus(viewGame(g,actor),card('ddos',node)).ok,true);g=applyAction(g,actor,card('ddos',node));assert.equal(g.players[victim].nodes[node].offline,true);
 }
});

test('v4 migration preserves the complete position and reserve, rejects unsupported future state',()=>{
 const old=ready();old.version=4;old.players[0].money=731;old.players[0].reserve='backup';old.players[0].reserveRound=1;old.players[1].nodes.web.access=2;old.players[0].hand=['phishing','phishing'];old.round=5;
 const before=structuredClone(old),up=upgradeGame(old);assert.equal(up.version,5);assert.deepEqual(up.players,before.players);assert.equal(up.round,5);assert.deepEqual(old,before);assert.deepEqual(upgradeGame(up),up);
 for(const version of [0,6,99,NaN,undefined])assert.throws(()=>upgradeGame({...up,version}),/версия матча/);
});

test('fraud, phishing and sabotage previews cannot reveal the secret reserve type',()=>{
 for(const attack of ['fraud','phishing','operation']){
  const projections=[];
  for(const counter of ['ddos','auth','backup']){
   let g=ready();g=applyAction(g,0,{type:'reserve',counter});g=end(g);prepare(g,1,[attack]);const node=attack==='operation'?'web':'workstation';reveal(g,1,node);Object.assign(g.players[0].nodes[node],{shield:0,auth:0,backup:false,access:attack==='phishing'?0:1});
   const v=viewGame(g,1);projections.push({v,status:actionStatus(v,card(attack,node)),ready:cardReadiness(v,attack)});
  }
  assert.deepEqual(projections[0],projections[1]);assert.deepEqual(projections[1],projections[2]);
 }
});


test('phishing cannot consume stealth intended for a later technical entry, regardless of counter source',()=>{
 for(const guard of ['none','local','reserve']){
  let g=ready();prepare(g,0,['stealth','phishing','entry']);reveal(g,0,'workstation');reveal(g,0,'web');g.players[1].nodes.workstation.auth=guard==='local'?1:0;g.players[1].reserve=guard==='reserve'?'auth':null;
  g=applyAction(g,0,{type:'card',card:'stealth'});g=applyAction(g,0,card('phishing','workstation'));assert.equal(g.players[0].quiet,true);
  if(guard==='none')assert.equal(g.players[1].nodes.workstation.detected,true);
  g=applyAction(g,0,card('entry','web'));assert.equal(g.players[0].quiet,false);assert.equal(g.players[1].nodes.web.detected,false);
 }
});


test('bot clears detected payment access even when workstation has sabotage recovery',()=>{
 const g=ready();g.players[0].hand=[];Object.assign(g.players[0].nodes.workstation,{access:1,detected:true,backup:true,auth:0});
 assert.deepEqual(botAction(g),{type:'cleanse',node:'workstation',side:'own'});
});


test('attack planner builds reachable same-turn chains from visible state and never spends on an impossible route',()=>{
 const g=ready();prepare(g,0,['entry','pivot','ddos']);for(const node of ['web','database'])reveal(g,0,node);
 const plans=planAttacks(viewGame(g,0));assert(plans.some(p=>p.action.card==='entry'&&p.action.node==='web'&&p.steps===3&&p.swing>0));
 g.ap=2;assert(!planAttacks(viewGame(g,0)).some(p=>p.action.card==='entry'&&p.action.node==='web'));
 const a=viewGame(g,0),snapshot=JSON.stringify(a);planAttacks(a);assert.equal(JSON.stringify(a),snapshot);
});

test('access previews recommend follow-ups legal for the target role',()=>{
 const g=ready();prepare(g,0,['entry','phishing']);reveal(g,0,'workstation');reveal(g,0,'control');g.players[1].nodes.workstation.auth=0;
 assert.match(actionStatus(viewGame(g,0),card('entry','workstation')).preview,/подменить платёж/);
 assert.doesNotMatch(actionStatus(viewGame(g,0),card('phishing','control')).preview,/саботаж/);
});


test('bot applies its finish-cash guard to planned attacks as well as single-card options',()=>{
 const g=ready();prepare(g,0,['operation']);g.players[0].money=2960;g.players[1].money=2700;
 for(const p of g.players)for(const n of Object.values(p.nodes))n.offline=true;
 Object.assign(g.players[1].nodes.web,{offline:false,income:180,upgrades:2,access:2,shield:0,backup:false});
 for(const node of ['web','workstation','database','files','control'])reveal(g,0,node);
 assert.equal(incomeOf(g.players[0]),40);assert.equal(incomeOf(g.players[1]),220);
 assert.deepEqual(botAction(g),{type:'end'});
});
