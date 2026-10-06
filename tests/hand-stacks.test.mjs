import test from 'node:test';
import assert from 'node:assert/strict';
import {groupHandStacks} from '../lib/game/hand-stacks.ts';
import {CARDS, applyAction, deploymentOf, newGame} from '../lib/game/engine.ts';

test('hand stacks preserve first appearance and all copies without mutating the hand', () => {
 const hand = Object.freeze(['shield', 'ddos', 'shield', 'supply', 'ddos', 'shield']);
 const stacks = groupHandStacks(hand);
 assert.deepEqual(stacks, [
  {card: 'shield', count: 3},
  {card: 'ddos', count: 2},
  {card: 'supply', count: 1},
 ]);
 assert.equal(stacks.reduce((total, stack) => total + stack.count, 0), hand.length);
 for (const kind of ['attack', 'defense', 'economy']) {
  assert.equal(
   stacks.filter(({card}) => CARDS[card].kind === kind).reduce((total, stack) => total + stack.count, 0),
   hand.filter(card => CARDS[card].kind === kind).length,
  );
 }
 assert.deepEqual(groupHandStacks([]), []);
});

test('playing the top card consumes one copy and the stack disappears only after the last copy', () => {
 let game = newGame('local', undefined, 34);
 for (let actor = 0; actor < 2; actor++) {
  game = applyAction(game, actor, {type: 'deploy', deployment: deploymentOf(game.players[actor])});
 }
 game.turn = 0;
 game.ap = 3;
 game.players[0].money = 1000;
 game.players[0].hand = ['patch', 'supply', 'patch'];
 game.players[0].nodes.web.offline = true;
 game = applyAction(game, 0, {type: 'card', card: 'patch', node: 'web', side: 'own'});
 assert.deepEqual(groupHandStacks(game.players[0].hand), [
  {card: 'supply', count: 1},
  {card: 'patch', count: 1},
 ]);
 game.players[0].nodes.web.offline = true;
 game = applyAction(game, 0, {type: 'card', card: 'patch', node: 'web', side: 'own'});
 assert.deepEqual(groupHandStacks(game.players[0].hand), [{card: 'supply', count: 1}]);
});
