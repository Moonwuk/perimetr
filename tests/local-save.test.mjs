import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,applyAction,deploymentOf} from '../lib/game/engine.ts';
import {decodeLocalSave,LOCAL_SAVE_KEY} from '../lib/game/local-save.ts';

test('local save restores a played match exactly',()=>{
 let g=newGame('bot',undefined,371);
 g=applyAction(g,0,{type:'deploy',deployment:deploymentOf(g.players[0])});
 g=applyAction(g,0,{type:'end'});
 assert.deepEqual(decodeLocalSave(JSON.stringify(g)),g);
});
test('a shared-phone setup retains both private layouts',()=>{
 const g=newGame('local',undefined,17);
 assert.deepEqual(decodeLocalSave(JSON.stringify(g)),g);
});
test('v0.4 saves migrate without losing layouts, money, hands, access or private reserve',()=>{
 const legacy=newGame('local',undefined,917);
 legacy.version=4;
 legacy.players[0].money=760;
 legacy.players[0].nodes.database.access=1;
 legacy.players[1].reserve='auth';
 legacy.players[1].reserveRound=1;
 const restored=decodeLocalSave(JSON.stringify(legacy));
 assert(restored);assert.equal(restored.version,5);
 assert.equal(LOCAL_SAVE_KEY,'contour-local-v4');
 assert.deepEqual(restored.players,legacy.players);
 assert.equal(restored.rng,legacy.rng);
 assert.equal(restored.round,legacy.round);
});
test('corrupt, oversized, foreign-version and online saves cannot resume locally',()=>{
 const g=newGame('local',undefined,17);
 for(const value of [null,'{',JSON.stringify({}),JSON.stringify({...g,version:999}),JSON.stringify({...g,turn:4}),JSON.stringify({...g,players:[]}),JSON.stringify(newGame('online')),JSON.stringify({...g,logs:'x'.repeat(256000)})])assert.equal(decodeLocalSave(value),null);
});
