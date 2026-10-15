import {newGame,applyAction,actionStatus,viewGame,type Game,type Action} from './engine.ts';
export const SCENARIOS={
 response:{name:'Обнаружен доступ',goal:'За 2 действия уберите обнаруженный доступ со станции, сохранив её работоспособность.',lesson:'Обнаружение — это сигнал. Очистка удаляет доступ, а карантин только отключает узел. Можно очистить доступ напрямую либо изолировать и применить аварийное восстановление.'},
 route:{name:'Путь к внутреннему сервису',goal:'За 3 действия проникните во внутренний сервис и подготовьте саботаж. Передайте ход учебному сопернику и завершите операцию за 1 действие.',lesson:'Путь проходит через веб-сервер: вход → боковое движение → подготовка саботажа → ответ защитника → завершение. В этой тренировке защитник пропускает ход. В партии он может очистить доступ, изолировать цель или подготовить восстановление.'},
} as const;
export type Scenario=keyof typeof SCENARIOS;
export function trainingGame(id:Scenario):Game{
 const g=newGame('local',['Вы','Учебная сеть'],1801);g.status='playing';g.players.forEach(p=>{p.ready=true;p.money=600;});g.ap=id==='response'?2:3;
 if(id==='response'){
  g.players[0].nodes.workstation.access=1;g.players[0].nodes.workstation.detected=true;
  g.players[0].hand=['purge','backup','patch'];
 }else{
  const enemy=g.players[1];enemy.layout={web:0,workstation:4,database:20,files:24,control:12,service1:6,service2:-1,service3:-1};
  Object.assign(enemy.nodes.service1,{built:true,profile:'internal',parent:'web',income:80});
  enemy.links=[['web','service1']];g.players[0].scanned=[0,6];g.players[0].hand=['entry','pivot','operation'];
  enemy.nodes.web.shield=0;enemy.nodes.service1.backup=false;
 }
 return g;
}
export function trainingAction(g:Game,a:Action):Game{
 if(a.type==='end'){
  if(g.turn!==0||g.ap!==0||!g.players[0].prepared)throw new Error('Сначала подготовьте саботаж за три действия.');
  const next=applyAction(applyAction(g,0,a),1,a);next.ap=1;return next;
 }
 if(!['card','scan','investigate','cleanse','isolate','restore','resolve'].includes(a.type))throw new Error('В сценарии используйте карты или действия узла.');
 if(!actionStatus(viewGame(g,0),a).ok)throw new Error(actionStatus(viewGame(g,0),a).reason);
 return applyAction(g,0,a);
}
export function trainingComplete(id:Scenario,g:Game):boolean{
 if(id==='response'){const n=g.players[0].nodes.workstation;return n.access===0&&!n.isolated&&!n.offline;}
 return g.players[1].nodes.service1.offline;
}
