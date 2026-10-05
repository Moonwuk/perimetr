import {BASE_INCOME,CARDS,COUNTER_LABELS,NODES,actionStatus,incomeOf,nameOf,type Action,type CardKind,type NodeId,type NodeState,type View} from './engine.ts';

export type ActionFeedback={id:string;viewer:number;title:string;kind:CardKind|'normal';lines:string[];spent:number;apSpent:number;blocked:boolean};
export type TurnSummary={id:string;viewer:number;round:number;changes:string[];problems:string[];expectedIncome:number;nextRoundIncome:number;lostIncome:number};
const liveIncome=(node:NodeState|null|undefined)=>node?.built&&!node.offline&&!node.isolated&&!node.interrupted?node.income:0;
const activeNodes=(view:View)=>NODES.filter(({id})=>view.players[view.viewer].nodes[id]?.built);

/** Only compare the actor's already-filtered views, after the action is acknowledged. */
export function describeAction(before:View,action:Action,after:View):ActionFeedback|null{
 if(before.viewer!==after.viewer||before.matchNumber!==after.matchNumber||before.status!=='playing'||after.status!=='playing'||after.serial<before.serial||!actionStatus(before,action).ok)return null;
 // Drawing with «Новый план» changes the hand/AP without creating a journal entry.
 if(after.serial===before.serial&&after.ap===before.ap&&after.players[after.viewer].money===before.players[before.viewer].money&&after.players[after.viewer].hand.join(',')===before.players[before.viewer].hand.join(','))return null;
 if(['end','deploy','surrender','rematch'].includes(action.type))return null;
 const viewer=before.viewer,me=after.players[viewer],oldMe=before.players[viewer],enemy=after.players[1-viewer],oldEnemy=before.players[1-viewer];
 const card=action.type==='card'?action.card:null;
 const id='node' in action?action.node:undefined;
 const own='side' in action&&action.side==='own';
 const node=id?(own?me:enemy).nodes[id]:null,oldNode=id?(own?oldMe:oldEnemy).nodes[id]:null;
 const target=id?nameOf(id):'Узел';
 const cashLost=Math.max(0,oldEnemy.money-enemy.money);
 const blocked=!!card&&!!node&&!!oldNode&&(
  card==='ddos'&&!node.offline&&(node.shield<oldNode.shield||oldEnemy.reserve!==null&&enemy.reserve===null)||
  card==='operation'&&!node.offline&&(oldNode.backup&&!node.backup||oldEnemy.reserve!==null&&enemy.reserve===null)||
  (card==='phishing'||card==='fraud')&&(node.auth<oldNode.auth||oldEnemy.reserve!==null&&enemy.reserve===null)
 );
 const stolen=card==='fraud'&&!blocked?cashLost:0;
 const spent=Math.max(0,oldMe.money-me.money+stolen),apSpent=Math.max(0,before.ap-after.ap);
 const result:ActionFeedback={id:`${after.matchNumber}:${viewer}:${after.serial}:${after.ap}:${card??action.type}`,viewer,title:card?CARDS[card].name:'Действие выполнено',kind:card?CARDS[card].kind:'normal',lines:[],spent,apSpent,blocked};
 const line=(text:string)=>result.lines.push(text);
 const restoration=()=>{
  if(node?.interrupted&&node.income>0)line(`Доход ${node.income} ¤ за этот раунд уже потерян: ремонт его не возвращает.`);
  if(node?.detected&&node.access>0)line('Обнаруженный чужой доступ остаётся. Нужна очистка.');
 };
 if(blocked){result.title='Атака отражена';line(`${target}: защита сработала. Казна и доход соперника сохранены.`);}
 else if(card==='ddos'||card==='operation'){
  result.title=node?.offline?`${target}: сервис остановлен`:'Атака выполнена';
  const lost=Math.max(0,liveIncome(oldNode)-liveIncome(node));
  line(`У соперника: −${cashLost} ¤ из казны; −${lost} ¤ дохода за этот раунд.`);
  if(node?.offline)line('Ремонт восстановит работу, но не вернёт уже потерянный доход.');
 }else if(card==='fraud'){
  result.title=`Перехвачено ${stolen} ¤`;
  line(stolen>0?`Ваша казна: ${me.money-oldMe.money>=0?'+':''}${me.money-oldMe.money} ¤ с учётом цены карты. Доступ отозван.`:'В казне соперника не было денег. Доступ отозван.');
 }else if(card==='recon'||action.type==='scan'){
  result.title='Разведка завершена';
  const found=NODES.filter(({id})=>!oldEnemy.nodes[id]&&enemy.nodes[id]).length;
  line(`Открыто клеток: ${Math.max(0,me.scanned.length-oldMe.scanned.length)}. Найдено узлов: ${found}.`);
 }else if(card==='entry'||card==='pivot'||card==='phishing'||card==='escalate'){
  result.title=node?.access===2?'Получены права администратора':node?.access?'Доступ получен':'Попытка завершена';
  line(`${target}: ${node?.access===2?'саботаж нанесёт усиленный штраф':node?.access?'теперь доступны действия из этого узла':'доступ не получен'}.`);
 }else if(card==='expand'||card==='optimize'){
  result.title=card==='expand'?'Новый сервер построен':`${target}: доход увеличен`;
  const gain=incomeOf(me)-incomeOf(oldMe);
  line(`К ближайшему начислению: ${gain>=0?'+':''}${gain} ¤. Всего ожидается ${incomeOf(me)} ¤.`);
  if(card==='optimize'&&gain===0)line('Мощность выросла; простой или потеря дохода в этом раунде пока мешает начислению.');
 }else if(card==='supply'||action.type==='draw'){
  result.title='План пополнен';line(`Получено карт: ${Math.max(0,me.hand.length-oldMe.hand.length+(card?1:0))}. В руке: ${me.hand.length}.`);
 }else if(action.type==='exchange'){
  result.title='Карта заменена';
  const replacement=me.hand[oldMe.hand.indexOf(action.card)];
  line(replacement?`Получена «${CARDS[replacement].name}». Замена на этот ход использована.`:'Бесплатная замена на этот ход использована.');
 }else if(action.type==='reserve'){
  result.title='Секретное дежурство готово';line(`${COUNTER_LABELS[action.counter]}: один подходящий удар по вашей сети будет отражён.`);
 }else if(action.type==='investigate'||card==='sensor'){
  result.title=node?.detected&&node.access>0?'Обнаружен чужой доступ':'Следы доступа не найдены';
  line(`${target}${card==='sensor'?': мониторинг установлен':': проверка завершена'}.`);
  if(node?.detected&&node.access>0)line('Обнаружение не удаляет доступ. Очистите узел или изолируйте его.');
 }else if(action.type==='isolate'||card==='segment'){
  result.title=`${target}: изолирован`;
  line(`Связи перекрыты. Доход за этот раунд: −${Math.max(0,liveIncome(oldNode)-liveIncome(node))} ¤.`);
  if(node?.detected&&node.access>0)line('Обнаруженный доступ сохраняется. Очистите узел перед восстановлением связи.');
 }else if(action.type==='restore'||card==='patch'||card==='backup'){
  result.title=card==='backup'?'Сервис восстановлен и защищён':card==='patch'?'Защита аккаунтов усилена':'Работа сервиса восстановлена';
  line(`${target}${card==='backup'?': доступ удалён, подготовлена защита от саботажа':card==='patch'?`: зарядов защиты ${node?.auth??0}`:': снова в сети'}.`);restoration();
 }else if(action.type==='cleanse'||card==='purge'){
  result.title=`${target}: очистка завершена`;
  line('Узел проверен и очищен: чужого доступа больше нет.');
  if(node?.offline||node?.isolated)line('Узел пока не работает. Восстановите связь, чтобы вернуть будущий доход.');
 }else if(card==='shield'){
  result.title='Защита от DDoS усилена';line(`${target}: зарядов защиты ${node?.shield??0}.`);
 }else if(card==='stealth'){
  result.title='Тихий проход подготовлен';line('Следующая попытка входа, перемещения или повышения прав обойдёт датчик.');
 }
 return result;
}

/** A short own-network briefing. Never reads enemy nodes, cards or private log text. */
export function summarizeTurn(previous:View|null,current:View):TurnSummary|null{
 if(current.status!=='playing'||current.turn!==current.viewer)return null;
 const me=current.players[current.viewer];
 const old=previous&&previous.viewer===current.viewer&&previous.matchNumber===current.matchNumber?previous.players[current.viewer]:null;
 const changes:string[]=[],problems:string[]=[];
 let lostIncome=0,nextRoundIncome=BASE_INCOME;
 for(const {id} of activeNodes(current)){
  const node=me.nodes[id]!,prior=old?.nodes[id],label=nameOf(id as NodeId);
  if(!node.offline&&!node.isolated)nextRoundIncome+=node.income;
  if(node.income>0&&(node.offline||node.isolated||node.interrupted))lostIncome+=node.income;
  if(node.offline)problems.push(`${label}: отключён`);
  else if(node.isolated)problems.push(`${label}: изолирован`);
  if(node.detected&&node.access>0)problems.push(`${label}: обнаружен доступ`);
  if(!old){
   if(node.offline)changes.push(`${label}: сервис остановлен.`);
   else if(node.isolated)changes.push(`${label}: изолирован.`);
   if(node.detected&&node.access>0)changes.push(`${label}: обнаружен чужой доступ.`);
   continue;
  }
  if(node.offline&&!prior?.offline)changes.push(`${label}: сервис остановлен.`);
  else if(node.isolated&&!prior?.isolated)changes.push(`${label}: изолирован.`);
  if(node.detected&&node.access>0&&(!prior?.detected||!prior.access))changes.push(`${label}: обнаружен чужой доступ.`);
  if(prior&&(node.shield<prior.shield||node.auth<prior.auth||prior.backup&&!node.backup))changes.push(`${label}: защита отразила удар.`);
 }
 if(old){
  if(old.reserve&&!me.reserve)changes.push('Секретное дежурство отразило удар и израсходовано.');
  const earned=Math.max(0,me.earned-old.earned),lost=Math.max(0,old.money+earned-me.money);
  if(lost>0)changes.unshift(`Из казны потеряно ${lost} ¤.`);
  if(earned>0)changes.push(`Начислен доход: +${earned} ¤.`);
 }
 if(!changes.length)changes.push(old?'Новых изменений в вашей сети нет.':'Ваш ход. Разведайте соперника или развивайте свою сеть.');
 return {id:`${current.matchNumber}:${current.viewer}:${current.round}`,viewer:current.viewer,round:current.round,changes:changes.slice(0,3),problems:problems.slice(0,3),expectedIncome:incomeOf(me),nextRoundIncome,lostIncome};
}
