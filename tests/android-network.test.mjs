import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('native API policy admits only configured HTTPS game requests',()=>{
 const directory=mkdtempSync(join(tmpdir(),'perimeter-native-policy-'));
 try{
  const compiled=spawnSync('javac',['-d',directory,'android/app/src/main/java/ru/moongametechnology/perimeter/NetworkPolicy.java','tests/android/NetworkPolicyCheck.java'],{encoding:'utf8'});
  assert.equal(compiled.status,0,compiled.error?.message||compiled.stderr);
  const checked=spawnSync('java',['-cp',directory,'ru.moongametechnology.perimeter.NetworkPolicyCheck'],{encoding:'utf8'});
  assert.equal(checked.status,0,checked.stderr);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
