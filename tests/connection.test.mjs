import test from 'node:test';
import assert from 'node:assert/strict';
import {roomConnection,connectionCountdown} from '../lib/game/connection.ts';

const snapshot={presence:[100_000,100_000],serverTime:100_000,syncedAt:1_000_000,now:1_000_000,viewer:0,playing:true,uncertain:false};
test('heartbeat write interval does not appear as an opponent disconnect',()=>{
 assert.equal(roomConnection({...snapshot,presence:[100_000,85_000]}).opponentAway,false);
 assert.equal(roomConnection({...snapshot,presence:[100_000,70_000]}).opponentAway,true);
});
test('recovery countdown follows server presence and failed polling cannot restart it',()=>{
 const early=roomConnection({...snapshot,uncertain:true,now:1_030_000});
 const late=roomConnection({...snapshot,uncertain:true,now:1_110_000});
 assert.equal(early.ownRemainingMs,90_000);
 assert.equal(late.ownRemainingMs,10_000);
 assert.equal(late.canClaim,false);
 assert.equal(roomConnection({...snapshot,now:1_120_000}).canClaim,false,'stale local snapshots cannot authorize a win');
});
test('a fresh server snapshot permits a claim only after the complete grace window',()=>{
 assert.equal(roomConnection({...snapshot,serverTime:220_000,presence:[220_000,100_001]}).canClaim,false);
 assert.equal(roomConnection({...snapshot,serverTime:220_000,presence:[220_000,100_000]}).canClaim,true);
 assert.equal(roomConnection({...snapshot,serverTime:220_000,presence:[220_000,100_000],playing:false}).canClaim,false);
 assert.equal(roomConnection({...snapshot,serverTime:220_000,presence:[220_000,100_000],uncertain:true}).canClaim,false);
});
test('returning opponent resets their countdown; finished matches do not display recovery',()=>{
 const restored=roomConnection({...snapshot,presence:[100_000,100_000]});
 assert.equal(restored.opponentRemainingMs,120_000);
 assert.equal(restored.opponentAway,false);
 assert.equal(roomConnection({...snapshot,playing:false}).active,false);
 assert.equal(connectionCountdown(61_001),'1:02');
 assert.equal(connectionCountdown(-1),'0:00');
});
test('a newly started match grants the full window even after a long wait in the lobby',()=>{
 const started=roomConnection({...snapshot,serverTime:300_000,presence:[300_000,100_000],startedAt:300_000});
 assert.equal(started.opponentRemainingMs,120_000);
 assert.equal(started.canClaim,false);
 assert.equal(started.opponentAway,false);
});
test('agreed pause stops disconnect claims and resume grants both players a fresh window',()=>{
 const paused=roomConnection({...snapshot,serverTime:400_000,presence:[100_000,100_000],paused:true});
 assert.equal(paused.active,false);
 assert.equal(paused.canClaim,false);
 for(const viewer of [0,1]){
  const resumed=roomConnection({...snapshot,serverTime:400_000,presence:[100_000,100_000],resumedAt:400_000,viewer});
  assert.equal(resumed.ownRemainingMs,120_000);
  assert.equal(resumed.opponentRemainingMs,120_000);
  assert.equal(resumed.canClaim,false);
 }
});
