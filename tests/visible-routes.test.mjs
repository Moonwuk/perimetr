import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,applyAction,deploymentOf,viewGame,actionStatus} from '../lib/game/engine.ts';
import {visibleRoutes,routeDescription,routeHint} from '../lib/game/visible-routes.ts';

function ready(actor=0){
 let game=newGame('local',undefined,321);
 for(let seat=0;seat<2;seat++)game=applyAction(game,seat,{type:'deploy',deployment:deploymentOf(game.players[seat])});
 game.turn=actor;game.ap=3;game.players[actor].hand=['pivot'];game.players[actor].money=500;
 // Adjacent cells are deliberately unrelated; genuine graph neighbours can be far apart.
 for(const player of game.players)Object.assign(player.layout,{web:0,workstation:1,control:12,database:24,files:4});
 return game;
}
function reveal(game,actor,...nodes){
 for(const id of nodes)game.players[actor].scanned.push(game.players[1-actor].layout[id]);
}
const routePairs=routes=>routes.map(route=>[route.from,route.to]);

test('route selection follows the existing graph rather than adjacent cells',()=>{
 const game=ready(),view=viewGame(game,0);
 const routes=visibleRoutes(view,'own',{cell:0,side:'own'},null);
 assert.deepEqual(routePairs(routes),[['web','database'],['web','control']]);
 assert(routes.every(route=>route.state==='connected'));
 assert.equal(visibleRoutes(view,'own',null,null).length,0);
 assert.equal(visibleRoutes(view,'own',{cell:0,side:'enemy'},null).length,0);
 assert(!JSON.stringify(routes).includes('service1')); // Unbuilt expansion is not a route endpoint.
});

test('enemy routes never disclose hidden endpoint positions, names or geometry, in either seat',()=>{
 for(const actor of [0,1]){
  const game=ready(actor);reveal(game,actor,'web');game.players[1-actor].nodes.web.access=1;
  let view=viewGame(game,actor);
  assert.deepEqual(visibleRoutes(view,'enemy',{cell:0,side:'enemy'},'pivot'),[]);
  // Even a malformed/unmasked payload is not accepted as authority for unscanned endpoints.
  view.players[1-actor].layout.database=24;view.players[1-actor].nodes.database={...game.players[1-actor].nodes.database};
  assert.deepEqual(visibleRoutes(view,'enemy',{cell:0,side:'enemy'},'pivot'),[]);
  reveal(game,actor,'database');view=viewGame(game,actor);
  const routes=visibleRoutes(view,'enemy',{cell:0,side:'enemy'},'pivot');
  assert.deepEqual(routePairs(routes),[['web','database']]);
  assert.equal(routes[0].toCell,24);
  assert(!routeDescription(routes[0]).includes('Служба доступа'));
  view.players[1-actor].nodes.database=null;
  assert.deepEqual(visibleRoutes(view,'enemy',null,'pivot'),[]);
 }
});

test('pivot arrows point from live acquired access to legal discovered targets',()=>{
 const game=ready();reveal(game,0,'web','workstation','control','database','files');
 game.players[1].nodes.web.access=1;
 const view=viewGame(game,0),routes=visibleRoutes(view,'enemy',null,'pivot');
 assert.deepEqual(routePairs(routes),[['web','database'],['web','control']]);
 for(const route of routes){
  assert.equal(route.state,'available');
  assert(actionStatus(view,{type:'card',card:'pivot',side:'enemy',node:route.to}).ok);
 }
 assert.deepEqual(routePairs(visibleRoutes(view,'enemy',{cell:24,side:'enemy'},'pivot')),[['web','database'],['database','control']]);
 assert.match(routeHint(view,'enemy',null,'pivot',routes),/2/);
 game.players[1].nodes.control.access=1;
 const next=visibleRoutes(viewGame(game,0),'enemy',null,'pivot');
 assert(!next.some(route=>route.from==='web'&&route.to==='control'));
 assert(next.some(route=>route.from==='control'&&route.to==='files'));
});

test('offline and isolated links are marked broken without suggesting that access disappeared',()=>{
 for(const flag of ['offline','isolated'])for(const id of ['web','database']){
  const game=ready();reveal(game,0,'web','database');game.players[1].nodes.web.access=1;game.players[1].nodes[id][flag]=true;
  const view=viewGame(game,0),routes=visibleRoutes(view,'enemy',null,'pivot');
  assert.equal(routes.length,1);assert.equal(routes[0].state,'blocked');
  assert.equal(view.players[1].nodes.web.access,1);
  assert.match(routeDescription(routes[0]),/разорвана/);
  assert.match(routeHint(view,'enemy',null,'pivot',routes),/отключён/);
 }
});

test('available route highlights honor money, AP, turn and held card',()=>{
 for(const change of [g=>{g.players[0].money=0;},g=>{g.ap=0;},g=>{g.turn=1;},g=>{g.players[0].hand=[];}]){
  const game=ready();reveal(game,0,'web','database');game.players[1].nodes.web.access=1;change(game);
  const view=viewGame(game,0);
  assert.deepEqual(visibleRoutes(view,'enemy',null,'pivot'),[]);
  assert(visibleRoutes(view,'enemy',{cell:24,side:'enemy'},'pivot').every(route=>route.state!=='available'));
 }
});

test('routes on your own board do not change when undetected hostile access changes',()=>{
 const game=ready(),selection={cell:0,side:'own'};
 const before=visibleRoutes(viewGame(game,0),'own',selection,null);
 game.players[0].nodes.web.access=2;game.players[0].nodes.control.access=1;game.players[0].reserve='ddos';
 assert.deepEqual(visibleRoutes(viewGame(game,0),'own',selection,null),before);
});
