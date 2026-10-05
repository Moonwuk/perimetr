import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,mkdirSync,readFileSync,copyFileSync,readdirSync,statSync,rmSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const src=resolve('server/deploy');
test('deployment backs up committed WAL, restores snapshots, and keeps generated secrets private',()=>{
const temp=mkdtempSync(join(tmpdir(),'perimeter-deploy-'));
const dbPath=join(temp,'perimeter.sqlite'), backupDir=join(temp,'backups');
const env={...process.env,DATABASE_PATH:dbPath,BACKUP_DIR:backupDir,BACKUP_KEEP:'2'};
function run(name,args=[],extra={}) {return execFileSync(process.execPath,[join(src,name),...args],{env:{...env,...extra},encoding:'utf8',stdio:['ignore','pipe','pipe']});}
function count(path){const d=new DatabaseSync(path,{readOnly:true});try{return d.prepare('SELECT count(*) AS n FROM rooms').get().n;}finally{d.close();}}
try{
 const db=new DatabaseSync(dbPath);db.exec('PRAGMA journal_mode=WAL;CREATE TABLE rooms(code TEXT PRIMARY KEY);INSERT INTO rooms VALUES (\'alpha\');');
 run('backup.mjs');
 const first=readdirSync(backupDir).find(n=>n.endsWith('.sqlite'));
 assert.equal(count(join(backupDir,first)),1);assert.equal(statSync(join(backupDir,first)).mode&0o777,0o600);
 db.exec("INSERT INTO rooms VALUES ('beta')");run('backup.mjs');db.exec("INSERT INTO rooms VALUES ('gamma')");run('backup.mjs');
 const snapshots=readdirSync(backupDir).filter(n=>n.startsWith('perimeter-')&&n.endsWith('.sqlite')).sort();
 assert.equal(snapshots.length,2);assert.equal(count(join(backupDir,snapshots[0])),2);assert.equal(count(join(backupDir,snapshots[1])),3);db.close();
 const denied=spawnSync(process.execPath,[join(src,'restore.mjs'),snapshots[0]],{env,encoding:'utf8'});assert.notEqual(denied.status,0);
 run('restore.mjs',[snapshots[0]],{CONFIRM_RESTORE:'1'});assert.equal(count(dbPath),2);
 const safety=readdirSync(backupDir).find(n=>n.startsWith('before-restore-'));assert.equal(count(join(backupDir,safety)),3);
 run('restore.mjs',[safety],{CONFIRM_RESTORE:'1'});assert.equal(count(dbPath),3);
 assert.ok(!readdirSync(backupDir).some(n=>n.includes('.partial')));
 console.log('PASS: committed WAL snapshot, integrity, 0600, retention=2, guarded restore, safety snapshot restore');
 const setupDir=join(temp,'setup');mkdirSync(setupDir);copyFileSync(join(src,'setup.sh'),join(setupDir,'setup.sh'));
 const setup=args=>spawnSync('sh',[join(setupDir,'setup.sh'),...args],{encoding:'utf8'});
 for(const args of [['https://bad.example','admin@example.com'],['good.example\nBAD=value','admin@example.com'],['good.example','admin@example.com\nBAD=value']]) assert.notEqual(setup(args).status,0);
 const success=setup(['game.example.com','admin@example.com']);assert.equal(success.status,0,success.stderr);
 const cfg=readFileSync(join(setupDir,'.env'),'utf8'),token=cfg.match(/^METRICS_EXPORT_TOKEN=([a-f0-9]{64})$/m)[1];
 assert.equal(statSync(join(setupDir,'.env')).mode&0o777,0o600);assert.ok(!success.stdout.includes(token));assert.notEqual(setup(['other.example','x@example.com']).status,0);assert.equal(readFileSync(join(setupDir,'.env'),'utf8'),cfg);
 console.log('PASS: setup validates origin/email including newlines, token generated privately, no overwrite');
 const localDir=join(temp,'local');mkdirSync(localDir);copyFileSync(join(src,'setup.sh'),join(localDir,'setup.sh'));execFileSync('sh',[join(localDir,'setup.sh'),'--local']);assert.match(readFileSync(join(localDir,'.env'),'utf8'),/^DOMAIN=localhost$/m);
 console.log('PASS: local SSH setup');
}finally{rmSync(temp,{recursive:true,force:true});}

});
