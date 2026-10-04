import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,applyAction,deploymentOf} from '../lib/game/engine.ts';
import {decodeLocalSave} from '../lib/game/local-save.ts';

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
test('corrupt, oversized, foreign-version and online saves cannot resume locally',()=>{
 const g=newGame('local',undefined,17);
 for(const value of [null,'{',JSON.stringify({}),JSON.stringify({...g,version:999}),JSON.stringify({...g,turn:4}),JSON.stringify({...g,players:[]}),JSON.stringify(newGame('online')),JSON.stringify({...g,logs:'x'.repeat(256000)})])assert.equal(decodeLocalSave(value),null);
});
