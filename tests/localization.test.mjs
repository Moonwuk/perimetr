import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS,NODES,newGame,viewGame,actionStatus,applyAction} from '../lib/game/engine.ts';
import {translateText,setLanguage,getLanguage,translateJournal} from '../lib/game/translate.ts';
import {english} from '../lib/game/locales/en.ts';
const en=s=>translateText(s,'en');
test('all card rules and node descriptions have complete English translations',()=>{
 for(const c of Object.values(CARDS))for(const key of ['name','short','detail','learn'])assert.doesNotMatch(en(c[key]),/[А-Яа-яЁё]/,c[key]);
 for(const n of NODES)for(const key of ['name','subtitle'])assert.doesNotMatch(en(n[key]),/[А-Яа-яЁё]/);
});
test('catalog templates preserve every interpolation slot',()=>{
 for(const [ru,en] of Object.entries(english)){const slots=s=>[...s.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort();assert.deepEqual(slots(en),slots(ru),ru);assert.doesNotMatch(en,/[А-Яа-яЁё]/,ru);}
});
test('dynamic resource requirements and nested server messages are translated',()=>{
 assert.equal(en('Нужно 240 кредитов. В казне 80.'),'Need 240 credits. Treasury: 80.');
 assert.equal(en('Нужно 1 действия. Осталось 0.'),'Need 1 actions. Remaining: 0.');
 assert.equal(en('Веб-сервер: сервис остановлен.'),'Web server: service offline.');
 assert.equal(en('Доход 100 ¤ за этот раунд уже потерян: ремонт его не возвращает.'),"This round's 100 ¤ income is already lost: repair will not recover it.");
 assert.equal(en('Получена «Новый сервер». Замена на этот ход использована.'),'Received “New server”. This turn\'s exchange is used.');
});
test('language switching does not mutate a game, action legality or saved messages',()=>{
 const g=newGame('local',['Alice','Bob'],4);g.status='playing';g.players.forEach(p=>p.ready=true);g.players[0].nodes.web.offline=true;g.players[0].nodes.web.interrupted=true;g.turn=0;
 const before=JSON.stringify(g),a={type:'restore',node:'web',side:'own'},status=actionStatus(viewGame(g,0),a);
 setLanguage('en');assert.equal(getLanguage(),'en');assert.equal(JSON.stringify(g),before);assert.deepEqual(actionStatus(viewGame(g,0),a),status);
 const after=applyAction(g,0,a);assert.equal(after.players[0].money,g.players[0].money);assert.equal(after.ap,g.ap-1);assert.equal(after.players[0].nodes.web.offline,false);assert.equal(after.players[0].nodes.web.interrupted,true);setLanguage('ru');
});
test('player-authored names remain verbatim in translated journals',()=>{
 setLanguage('en');assert.equal(translateJournal('Защита сдаётся. Побеждает Моя сеть.',['Защита','Моя сеть']),'Защита surrenders. Моя сеть wins.');setLanguage('ru');
});
test('Russian remains unchanged and unknown text is never discarded',()=>{
 assert.equal(translateText('  Восстановить  ','ru'),'  Восстановить  ');assert.equal(en('  Восстановить  '),'  Restore  ');assert.equal(en('Acme #41'),'Acme #41');
});
test('compound labels translate their components without truncating effects',()=>{
 const c=CARDS.optimize;
 const label=`${en(c.name)}: ${c.money} кредитов, ${c.cost} действия. ${en(c.short)} ${en('Нажмите, чтобы выбрать, или удерживайте и перенесите на цель.')}`;
 assert.doesNotMatch(en(label),/[А-Яа-яЁё]/);
 const g=newGame('bot',['A','B'],3);g.status='playing';g.turn=0;g.ap=0;
 assert.doesNotMatch(en(actionStatus(viewGame(g,0),{type:'restore',node:'web',side:'own'}).reason),/[А-Яа-яЁё]/);
});
