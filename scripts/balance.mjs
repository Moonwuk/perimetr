// Exploratory comparisons of simple policies, not proof of human balance.
const engine=await import(process.env.BALANCE_ENGINE||'../lib/game/engine.ts');
const {newGame,applyAction,viewGame,botAction,deploymentOf,actionStatus,incomeOf,CARDS,NODES,MONEY_GOAL,MAX_ROUNDS,attackSwing,scanArea}=engine;
const end={type:'end'},seeds=Number(process.argv[2]??40),offset=Number(process.argv[3]??0);
if(!Number.isInteger(seeds)||seeds<1||seeds>200||!Number.isInteger(offset)||offset<0||offset+seeds>0xffffffff)throw new Error('Use 1–200 seeds.');
function policy(v,style){
 const p=v.players[v.viewer],enemy=v.players[1-v.viewer],valid=a=>actionStatus(v,a).ok;
 const action=(card,node,side='own')=>({type:'card',card,node,side});
 // All policies can react, repair, exchange useless cards and develop.
 for(const n of NODES){const own=p.nodes[n.id];if(!own)continue;
  if(own.detected&&!own.backup){for(const a of [action('backup',n.id),action('purge',n.id),{type:'cleanse',node:n.id,side:'own'}])if(valid(a))return a;}
  if(own.offline&&style==='defender'&&valid(action('patch',n.id)))return action('patch',n.id);
  const repair={type:'restore',node:n.id,side:'own'};if((own.offline||own.isolated)&&valid(repair))return repair;
 }
 // Estimate unrevealed core income; a hidden server is not a zero-income server.
 const enemyIncome=40+NODES.reduce((s,n)=>s+(enemy.nodes[n.id]?incomeOf({nodes:{[n.id]:enemy.nodes[n.id]}})-40:({web:100,database:80,files:60}[n.id]??0)),0);
 if(p.money+incomeOf(p)>=MONEY_GOAL&&p.money+incomeOf(p)>enemy.money+enemyIncome)return end;
 const attacks=[];
 for(const n of NODES){const target=enemy.nodes[n.id];if(!target)continue;
  for(const c of ['ddos','phishing','operation']){const a=action(c,n.id,'enemy'),value=attackSwing(c,n.id,target,enemy.money,enemy.reserve);if(value>0&&valid(a))attacks.push({a,value});}
  if(p.hand.includes('operation')&&!target.backup&&(target.income>0||n.id==='control'))for(const c of ['entry','pivot']){const a=action(c,n.id,'enemy'),value=attackSwing('operation',n.id,{...target,access:1},enemy.money)-CARDS[c].money;if(value>0&&valid(a))attacks.push({a,value:value/2});}
 }
 attacks.sort((a,b)=>b.value-a.value);
 const scout=()=>{
  const options=[];for(let cell=0;cell<25;cell++)for(const a of [{type:'scan',cell,side:'enemy'},{type:'card',card:'recon',cell,side:'enemy'}]){
   if(valid(a))options.push({a,value:scanArea(cell,a.type==='card').filter(c=>!p.scanned.includes(c)).length-(a.type==='card'?.8:0)});
  }
  options.sort((a,b)=>b.value-a.value);return options[0]?.a;
 };
 if(style==='raider'){
  if(attacks.length)return attacks[0].a;
  if(p.hand.some(c=>['ddos','phishing','entry'].includes(c))){const a=scout();if(a)return a;}
 }
 if(style==='defender'&&v.round>1&&v.ap===3&&p.money>=205){
  const recent=v.logs.filter(l=>l.round>=v.round-2&&l.tone==='attack'&&!l.text.startsWith(p.name+':')),ddos=recent.some(l=>l.text.includes('DDoS:')),phishing=recent.some(l=>l.text.includes('фишинг'));
  if(engine.RESERVE_COST!==undefined&&!p.reserve){const counter=phishing?'auth':ddos?'ddos':null,a={type:'reserve',counter};if(counter&&valid(a))return a;}
  for(const n of [...NODES].sort((a,b)=>(p.nodes[b.id]?.income??0)-(p.nodes[a.id]?.income??0))){const own=p.nodes[n.id];if(!own)continue;
   for(const [card,needed] of [['shield',!own.shield&&(ddos||own.income>=100)],['patch',!own.auth&&phishing],['backup',!own.backup&&own.income>=100&&recent.some(l=>l.text.includes('саботаж'))]]){const a=action(card,n.id);if(needed&&valid(a))return a;}
  }
 }
 const turns=Math.max(1,Math.min(MAX_ROUNDS-v.round+1,Math.ceil((MONEY_GOAL-p.money)/incomeOf(p)),Math.ceil((MONEY_GOAL-enemy.money)/Math.max(1,enemyIncome))));
 const free=Array.from({length:25},(_,i)=>i).find(i=>!Object.values(p.layout).includes(i)),expand={type:'card',card:'expand',cell:free,side:'own'};
 if(valid(expand)&&turns*100>CARDS.expand.money)return expand;
 for(const n of NODES){const a=action('optimize',n.id);if(valid(a)&&turns*40>CARDS.optimize.money)return a;}
 if(style!=='economy'&&attacks.length)return attacks[0].a;
 const wanted=style==='raider'?'attack':'economy';
 for(const c of p.hand)if(CARDS[c].kind!==wanted){const a={type:'exchange',card:c,kind:wanted};if(valid(a))return a;}
 const draw={type:'draw'};return valid(draw)?draw:end;
}
const policies={economy:v=>policy(v,'economy'),raider:v=>policy(v,'raider'),defender:v=>policy(v,'defender'),bot:botAction};
for(const [left,right] of [['raider','economy'],['defender','raider'],['economy','defender'],['bot','economy'],['bot','raider']]){
 let wins=0,ties=0,losses=0,rounds=0,firstWins=0,secondWins=0,cards={};
 for(let seed=offset+1;seed<=offset+seeds;seed++)for(let flip=0;flip<2;flip++){
  let g=newGame('local',undefined,seed);for(let actor=0;actor<2;actor++)g=applyAction(g,actor,{type:'deploy',deployment:deploymentOf(g.players[actor])});
  for(let steps=0;g.status==='playing'&&steps<MAX_ROUNDS*12;steps++){
   const actor=g.turn,a=g.ap===0?end:policies[actor===flip?left:right](viewGame(g,actor));
   if((a.type==='card'||a.type==='reserve')&&actor===flip)cards[a.card??'reserve']=(cards[a.card??'reserve']??0)+1;
   g=applyAction(g,actor,a);
  }
  if(g.status!=='finished')throw new Error('Non-terminating match');
  if(g.winner===null)ties++;else if(g.winner===flip)wins++;else losses++;
  if(g.winner===0)firstWins++;if(g.winner===1)secondWins++;rounds+=g.round;
 }
 console.log(JSON.stringify({pair:`${left} vs ${right}`,seedRange:[offset+1,offset+seeds],games:seeds*2,wins,ties,losses,averageRounds:rounds/(seeds*2),firstWins,secondWins,cards}));
}
