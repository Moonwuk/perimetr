export type NodeId = 'web' | 'workstation' | 'database' | 'files' | 'control' | 'service1' | 'service2' | 'service3';
export type CardId = 'recon' | 'entry' | 'pivot' | 'escalate' | 'operation' | 'shield' | 'patch' | 'sensor' | 'backup' | 'stealth' | 'supply' | 'purge' | 'phishing' | 'fraud' | 'segment' | 'expand' | 'optimize' | 'ddos';
export type CardKind = 'attack' | 'defense' | 'economy';
export type Side = 'own' | 'enemy';
export type Mode = 'bot' | 'local' | 'online';
export const GRID = 5;
export const MONEY_GOAL=3000;
export const MAX_ROUNDS=12;
export const BASE_INCOME=40;
export const RESERVE_COST=30;
export const FRAUD_AMOUNT=80;
export const isPublicService=(id:NodeId)=>id==='web'||id.startsWith('service');
export const hasAccountSurface=(id:NodeId)=>id==='workstation'||id==='control';
export const NODES: {id:NodeId;name:string;subtitle:string;entry:boolean;x:number;y:number}[] = [
 {id:'web',name:'Веб-сервер',subtitle:'Публичный сервис · 100 за раунд',entry:true,x:21,y:23},
 {id:'workstation',name:'Рабочая станция',subtitle:'Учётная запись сотрудника · платежи',entry:true,x:79,y:23},
 {id:'database',name:'База данных',subtitle:'Данные компании · 80 за раунд',entry:false,x:21,y:72},
 {id:'files',name:'Файловый сервер',subtitle:'Документы · 60 за раунд',entry:false,x:79,y:72},
 {id:'control',name:'Служба доступа',subtitle:'Связывает все узлы',entry:false,x:50,y:47},
];
export const CORE_NODES=[...NODES];
NODES.push(
 {id:'service1',name:'Новый сервер I',subtitle:'Публичный сервис · 100 за раунд',entry:false,x:0,y:0},
 {id:'service2',name:'Новый сервер II',subtitle:'Публичный сервис · 100 за раунд',entry:false,x:0,y:0},
 {id:'service3',name:'Новый сервер III',subtitle:'Публичный сервис · 100 за раунд',entry:false,x:0,y:0},
);
export const LINKS: [NodeId,NodeId][] = [['web','database'],['web','control'],['workstation','files'],['workstation','control'],['control','database'],['control','files'],['web','service1'],['files','service2'],['control','service3']];
export const OBJECTIVES = [
 {id:'archive',node:'files' as NodeId,name:'Забрать архив',points:4,description:'Права администратора на файловом сервере.'},
 {id:'record',node:'database' as NodeId,name:'Подменить запись',points:4,description:'Права администратора в базе данных.'},
 {id:'outage',node:'web' as NodeId,name:'Остановить сервис',points:3,description:'Права администратора на веб-сервере.'},
];
const originalCards: Partial<Record<CardId,{name:string;kind:'attack'|'defense'|'economy';cost:number;money:number;side:Side|'none';short:string;detail:string;learn:string;icon:string}>> = {
 recon:{name:'Разведка',kind:'attack',cost:1,money:20,side:'enemy',short:'Раскрыть 3 × 3 и контрмеры.',detail:'Раскрывает область 3×3. Найденные узлы показывают доход, анти-DDoS, защиту аккаунтов и планы восстановления. Выберите атаку под слабое место.',learn:'Разведка помогает понять поверхность атаки. Знание узла само по себе не даёт доступа к нему.',icon:'scan'},
 entry:{name:'Точка входа',kind:'attack',cost:1,money:15,side:'enemy',short:'Доступ через внешний вход.',detail:'Даёт доступ к найденному веб-серверу или рабочей станции. Анти-DDoS и защита аккаунтов не блокируют техническое проникновение. На веб-сервере после входа доступен саботаж; на рабочей станции — подмена платежа или переход к связанным узлам.',learn:'Первоначальный доступ — первый шаг внутрь системы. Снижение поверхности атаки усложняет этот шаг.',icon:'entry'},
 pivot:{name:'Боковое движение',kind:'attack',cost:1,money:15,side:'enemy',short:'Доступ к связанному узлу.',detail:'Даёт доступ к найденной цели через связанный работающий узел с вашим доступом. Анти-DDoS и защита аккаунтов не блокируют переход. Изоляция разрывает маршрут.',learn:'Боковое перемещение — переход между узлами после первоначального доступа. Сегментация ограничивает такие маршруты.',icon:'pivot'},
 escalate:{name:'Повышение прав',kind:'attack',cost:1,money:15,side:'enemy',short:'Усилить саботаж на 50%.',detail:'Повышает обычный доступ до административного. Штраф при саботаже увеличивается на 50%. Для обычного саботажа повышение прав не требуется.',learn:'Повышение привилегий увеличивает полномочия уже полученной учётной записи или процесса.',icon:'key'},
 operation:{name:'Саботаж',kind:'attack',cost:1,money:40,side:'enemy',short:'Сбой и штраф. Нужен доступ.',detail:'Расходует доступ к доходному серверу, отключает его до ремонта, лишает дохода за раунд и списывает из казны соперника сумму дохода. Админ-доступ усиливает штраф на 50%. Аварийное восстановление отражает саботаж и удаляет доступ. Для кражи денег нужна отдельная карта «Подмена платежа».',learn:'Конфиденциальность, целостность и доступность — три свойства информации. Задачи игры моделируют угрозы каждому из них.',icon:'target'},
 shield:{name:'Анти-DDoS',kind:'defense',cost:1,money:25,side:'own',short:'+1 защита от DDoS.',detail:'Добавляет один заряд защиты от DDoS, максимум два. Заряд полностью отражает один DDoS. Не защищает от фишинга, технического проникновения и саботажа.',learn:'Фильтрация и защита от перегрузок повышают доступность. Они не заменяют защиту учётных записей и резервное копирование.',icon:'shield'},
 patch:{name:'Защита аккаунтов',kind:'defense',cost:1,money:25,side:'own',short:'+1 защита от фишинга. Ремонт.',detail:'Добавляет один заряд защиты от фишинга или подмены платежа, максимум два, и восстанавливает сервис. При отражении подмены платежа скомпрометированный доступ отзывается. Само применение карты не удаляет уже полученный доступ и не возвращает потерянный доход.',learn:'Проверка входов и устойчивая к фишингу аутентификация снижают риск захвата аккаунтов. В этой карте также подразумевается независимое подтверждение платежей: одной аутентификации недостаточно для проверки реквизитов. От перегрузки эта мера не защищает.',icon:'key'},
 sensor:{name:'Мониторинг',kind:'defense',cost:1,money:15,side:'own',short:'Обнаруживать активность на узле.',detail:'Устанавливает датчик. Немедленно обнаруживает существующий доступ и замечает последующие атаки, кроме скрытой.',learn:'Средства обнаружения собирают события и помогают расследованию. Обнаружить угрозу и заблокировать её — разные задачи.',icon:'eye'},
 backup:{name:'Аварийное восстановление',kind:'defense',cost:1,money:45,side:'own',short:'Защита от саботажа. Очистка.',detail:'Удаляет чужой доступ, восстанавливает сервис и готовит план аварийного восстановления. Один следующий саботаж автоматически отражается без потери денег и дохода. План расходуется. Не отражает DDoS, фишинг или подмену платежа. Уже потерянный доход не возвращает.',learn:'Это упрощённый комплекс мер: устранение угрозы, восстановление из проверенной копии и готовность к новому сбою. Одна резервная копия сама по себе не удаляет злоумышленника.',icon:'backup'},
 stealth:{name:'Тихий проход',kind:'attack',cost:1,money:10,side:'none',short:'Следующая атака обойдёт датчик.',detail:'Одна следующая попытка входа, бокового движения или повышения прав не вызывает сигнал датчика. Уже обнаруженный доступ остаётся видимым.',learn:'Отсутствие сигнала не доказывает отсутствие атаки. Защитнику нужны независимые источники событий и расследования.',icon:'stealth'},
 supply:{name:'Новый план',kind:'economy',cost:1,money:20,side:'none',short:'Добрать 2 карты.',detail:'Берёт две карты из колоды. Рука вмещает 10 карт. Пустая колода заново перемешивается из сброса.',learn:'В игре время и доступные действия ограничены: подготовка иногда полезнее немедленной атаки.',icon:'cards'},
 purge:{name:'Реагирование',kind:'defense',cost:1,money:25,side:'own',short:'Найти и полностью убрать доступ.',detail:'Расследует выбранный узел и полностью вытесняет противника. Сервис остаётся доступным.',learn:'Реагирование включает анализ инцидента, сдерживание и устранение угрозы. В игре это упрощено до одного действия.',icon:'purge'},
 phishing:{name:'Фишинг',kind:'attack',cost:1,money:15,side:'enemy',short:'Доступ к учётной записи.',detail:'Получает обычный доступ к найденной рабочей станции или службе доступа. Денег не крадёт. У владельца появляется сигнал о подозрительном входе. Защита аккаунтов отражает попытку и теряет заряд. Для подмены платежа нужен доступ к рабочей станции; для серверов — боковое движение.',learn:'Фишинг обманывает человека, чтобы получить учётные данные или первоначальный доступ. Кража денег — отдельное последующее действие; автоматический сигнал в игре — условность для ответного хода.',icon:'mail'},
 fraud:{name:'Подмена платежа',kind:'attack',cost:1,money:35,side:'enemy',short:'Украсть до 80. Нужен доступ.',detail:'Только рабочая станция с вашим доступом: подменяет платёж и переводит вам до 80 кредитов. Доступ после попытки расходуется. Защита аккаунтов отражает подмену, расходует заряд и отзывает доступ. Сервис продолжает работать. Права администратора сумму не увеличивают.',learn:'Компрометация учётной записи может позволить подменить платёжные реквизиты. В игре платёжная учётная запись закреплена за рабочей станцией; в реальности нужны её конкретные полномочия и отсутствие независимой проверки платежа.',icon:'mail'},
 segment:{name:'Карантин узла',kind:'defense',cost:1,money:50,side:'own',short:'Разорвать маршрут. Защита входа.',detail:'Изолирует узел и добавляет заряд защиты аккаунтов. Чужой доступ сохраняется, но не действует до восстановления. Доход узла за текущий раунд теряется.',learn:'Карантин изолирует узел на время расследования. Это полное отключение, а не постоянное разделение сети на сегменты. Устранение угрозы и возврат в работу требуют отдельных действий.',icon:'lock'},
};
export const CARDS=Object.assign(originalCards,{
 expand:{name:'Новый сервер',kind:'economy',cost:1,money:240,side:'own',short:'+100 дохода. Новая цель.',detail:'Поставьте сервер в свободную клетку. Он сразу приносит 100 за раунд, но нуждается в защите. Максимум три новых сервера.',learn:'Рост инфраструктуры увеличивает производительность и число активов, которые нужно защищать.',icon:'server'},
 optimize:{name:'Модернизация',kind:'economy',cost:1,money:120,side:'own',short:'+40 дохода серверу.',detail:'Повышает доход работающего сервера на 40. Максимум два улучшения на узел.',learn:'Доходность критичных активов помогает определить приоритет защиты.',icon:'trend'},
 ddos:{name:'DDoS',kind:'attack',cost:1,money:40,side:'enemy',short:'Сбой, потеря дохода и контрактов.',detail:'Отключает найденный публичный сервис (веб-сервер или новый сервер) до ремонта. Для внутренней базы данных или файлового сервера сначала нужен ваш доступ к этому узлу. Соперник теряет доход этого сервера за раунд и до половины его дохода сразу из казны за срыв контрактов. Анти-DDoS поглощает попытку и теряет один заряд. Защита аккаунтов и план восстановления не помогают.',learn:'DDoS нарушает доступность сервиса. Публичный сервис можно перегрузить извне. В игре та же карта моделирует перегрузку внутреннего узла только после проникновения; это упрощение разных способов отказа в обслуживании.',icon:'zap'},
}) as Record<CardId,{name:string;kind:'attack'|'defense'|'economy';cost:number;money:number;side:Side|'none';short:string;detail:string;learn:string;icon:string}>;
export type NodeState = {built:boolean;income:number;upgrades:number;interrupted:boolean;shield:number;auth:number;backup:boolean;sensor:boolean;access:number;detected:boolean;isolated:boolean;offline:boolean};
export type Player = {reserve:Countermeasure|null;reserveRound:number;name:string;money:number;earned:number;nodes:Record<NodeId,NodeState>;layout:Record<NodeId,number>;scanned:number[];ready:boolean;exchangeRound?:number;drawHistory?:CardKind[];interrupted:boolean;intel:NodeId[];hand:CardId[];deck:CardId[];discard:CardId[];score:number;uptime:number;objectives:string[];quiet:boolean};
export type LogEntry = {id:number;round:number;text:string;audience:number|'all';tone:'normal'|'attack'|'defense'|'score'};
export type MatchStats={spent:number;attacks:number;defenses:number;economy:number;blocked:number;stolen:number;cashLost:number};
const emptyStats=():MatchStats=>({spent:0,attacks:0,defenses:0,economy:0,blocked:0,stolen:0,cashLost:0});
export type Game = {version:5;firstPlayer:number;matchNumber:number;rematchVotes:number[];stats:[MatchStats,MatchStats];mode:Mode;players:[Player,Player];turn:number;round:number;ap:number;status:'waiting'|'setup'|'playing'|'finished';winner:number|null;startedAt?:number;resumedAt?:number;pause?:{requestedBy:0|1;pausedAt:number|null};finishReason?:'surrender'|'disconnect'|'score';logs:LogEntry[];serial:number;rng:number};
export type PauseDecision='request'|'accept'|'decline'|'cancel'|'resume';
export type Deployment = {layout:number[];shields:number[];sensors:number[];auth?:number[];backups?:number[]};
export type Action = {type:'card';card:CardId;node?:NodeId;cell?:number;side?:Side}|{type:'scan';cell:number;side:'enemy'}|{type:'investigate'|'isolate'|'restore'|'cleanse';node:NodeId;side:Side}|{type:'deploy';deployment:Deployment}|{type:'exchange';card:CardId;kind:CardKind}|{type:'draw'}|{type:'end'}|{type:'surrender'}|{type:'reserve';counter:Countermeasure}|{type:'rematch'};
export type PlayerView = Omit<Player,'hand'|'deck'|'discard'|'nodes'|'layout'|'reserve'> & {reserve:Countermeasure|'hidden'|null;nodes:Record<NodeId,NodeState|null>;layout:Partial<Record<NodeId,number>>;hand:CardId[];handCount:number;deckCount:number;discardCount:number;exchangeOptions:Partial<Record<CardId,CardKind[]>>};
export type View = Omit<Game,'players'|'rng'|'stats'> & {players:[PlayerView,PlayerView];viewer:number;stats?:[MatchStats,MatchStats]};
export type ActionStatus = {ok:boolean;cost:number;reason:string;preview:string};
const ids=NODES.map(n=>n.id);
const coreIds=CORE_NODES.map(n=>n.id);
const defaultIncome=(id:NodeId)=>id==='web'?100:id==='database'?80:id==='files'?60:id.startsWith('service')?100:0;
const initialCore:CardId[]=['recon','ddos','shield','expand','optimize'];
const defensePool:CardId[]=['patch','backup'];
const cardKinds:CardKind[]=['attack','defense','economy'];
const deck:CardId[]=[
 'recon','recon','ddos','ddos','phishing','fraud','entry','pivot','escalate','operation','operation','stealth',
 'shield','shield','patch','patch','patch','sensor','backup','backup','backup','purge','purge','segment',
 'expand','expand','optimize','optimize','optimize','optimize','optimize','optimize','supply','supply','supply','supply',
];
function random(g:{rng:number}){g.rng=(Math.imul(g.rng,1664525)+1013904223)>>>0;return g.rng/4294967296;}
function shuffle<T>(g:{rng:number},arr:T[]){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(random(g)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function balancedShuffle(g:{rng:number},cards:CardId[]):CardId[]{
 const order=shuffle(g,cardKinds),piles=Object.fromEntries(cardKinds.map(kind=>[kind,shuffle(g,cards.filter(c=>CARDS[c].kind===kind))])) as Record<CardKind,CardId[]>;
 const result:CardId[]=[];
 while(order.some(kind=>piles[kind].length))for(const kind of order){const c=piles[kind].shift();if(c)result.push(c);}
 return result;
}
function exchangeOptions(p:Player):Partial<Record<CardId,CardKind[]>>{
 const available=[...p.deck,...p.discard];
 return Object.fromEntries([...new Set(p.hand)].map(card=>[card,cardKinds.filter(kind=>available.some(c=>c!==card&&CARDS[c].kind===kind))]));
}
function log(g:Game,text:string,audience:number|'all'='all',tone:LogEntry['tone']='normal'){g.logs.push({id:++g.serial,round:g.round,text,audience,tone});g.logs=g.logs.slice(-120);}
export const coordinate=(cell:number)=>`${'ABCDE'[cell%GRID]}${Math.floor(cell/GRID)+1}`;
export const nameOf=(id:NodeId)=>NODES.find(n=>n.id===id)?.name??'Узел';
export function scanArea(cell:number,wide=false):number[]{
 if(!Number.isInteger(cell)||cell<0||cell>=25)return [];
 return Array.from({length:25},(_,i)=>i).filter(i=>{const dx=Math.abs(i%5-cell%5),dy=Math.abs(Math.floor(i/5)-Math.floor(cell/5));return wide?dx<=1&&dy<=1:dx+dy<=1;});
}
export function newGame(mode:Mode,names:[string,string]=['Оператор 01','Оператор 02'],seed=Date.now()):Game{
 const r={rng:seed>>>0},opening=shuffle(r,[...initialCore,...shuffle(r,defensePool).slice(0,1)]),ordered=balancedShuffle(r,deck);
 const make=(name:string,index:number):Player=>({name,reserve:null,reserveRound:0,money:300,earned:0,nodes:Object.fromEntries(ids.map((id,i)=>[id,{built:i<5,income:defaultIncome(id),upgrades:0,interrupted:false,shield:id==='web'?1:0,auth:id==='workstation'?1:0,backup:id==='database',sensor:id==='web',access:0,detected:false,isolated:false,offline:false}])) as Player['nodes'],layout:Object.fromEntries(shuffle(r,Array.from({length:25},(_,i)=>i)).slice(0,5).map((cell,i)=>[ids[i],cell])) as Player['layout'],scanned:[],ready:mode==='bot'&&index===1,exchangeRound:0,interrupted:false,intel:[],hand:[...opening],deck:[...ordered],discard:[],score:0,uptime:0,objectives:[],quiet:false});
 const players:[Player,Player]=[make(names[0],0),make(names[1],1)];
 const g:Game={version:5,firstPlayer:0,matchNumber:1,rematchVotes:[],stats:[emptyStats(),emptyStats()],mode,players,turn:0,round:1,ap:3,status:mode==='online'?'waiting':'setup',winner:null,logs:[],serial:0,rng:r.rng};
 log(g,'Разместите пять узлов. Четыре жетона: анти-DDoS, защита аккаунтов, восстановление или датчик.');return g;
}
// Upgrade stored rooms without changing layouts, hands, cash, or existing access.
export function upgradeGame(input:Game):Game{
 const version=(input as {version:number}).version;
 if(!Number.isInteger(version)||version<1||version>5)throw new Error('Неподдерживаемая версия матча. Обновите игру.');
 if(version===5)return input;
 const g=structuredClone(input) as Game;
 if(version===1){
  for(const p of g.players){p.money=300+p.score*50;p.earned=p.score*50;p.layout=Object.fromEntries(coreIds.map((id,i)=>[id,[0,4,20,24,12][i]])) as Player['layout'];for(const id of ids){if(!p.nodes[id])p.nodes[id]={shield:0,auth:0,backup:false,sensor:false,access:0,detected:false,isolated:false,offline:false,built:false,income:100,upgrades:0,interrupted:false};else Object.assign(p.nodes[id],{built:true,income:defaultIncome(id),upgrades:0,interrupted:p.nodes[id].isolated||p.nodes[id].offline});}p.scanned=p.intel.map(id=>p.layout[id]);p.ready=g.status!=='waiting';p.interrupted=ids.some(id=>['web','database'].includes(id)&&(p.nodes[id].isolated||p.nodes[id].offline));}
 }
 for(const p of g.players)for(const n of Object.values(p.nodes)){n.auth??=0;n.backup??=false;}
 g.version=5;g.firstPlayer??=0;g.matchNumber??=1;g.rematchVotes??=[];g.stats??=[emptyStats(),emptyStats()];
 for(const p of g.players){p.reserve??=null;p.reserveRound??=0;}
 log(g,'Правила 0.5: дежурство сохраняется до удара; очистка обнаруженного доступа стоит одно действие. Фишинг даёт только доступ к учётной записи, подмена платежа — отдельная карта. Внутренние серверы доступны для перегрузки только после проникновения.');
 return g;
}
function draw(g:Game,p:Player,count:number){
 for(let i=0;i<count;i++){
  if(p.hand.length>=10)break;
  if(!p.deck.length&&p.discard.length){p.deck=balancedShuffle(g,p.discard);p.discard=[];}
  if(!p.deck.length)break;
  const recent=p.drawHistory?.slice(-2)??[];
  let index=p.deck.findIndex(c=>!recent.includes(CARDS[c].kind));
  if(index<0)index=p.deck.findIndex(c=>CARDS[c].kind!==recent.at(-1));
  const [c]=p.deck.splice(index<0?0:index,1);p.hand.push(c);p.drawHistory=[...recent,CARDS[c].kind].slice(-2);
 }
}
export function deploymentOf(p:Player|PlayerView):Deployment{return {layout:coreIds.map(id=>p.layout[id]??0),shields:coreIds.map(id=>p.nodes[id]?.shield??0),auth:coreIds.map(id=>p.nodes[id]?.auth??0),backups:coreIds.map(id=>p.nodes[id]?.backup?1:0),sensors:coreIds.map(id=>p.nodes[id]?.sensor?1:0)};}
export function deploymentError(d:Deployment):string{
 if(!d||!Array.isArray(d.layout)||d.layout.length!==5||d.layout.some(c=>!Number.isInteger(c)||c<0||c>24)||new Set(d.layout).size!==5)return 'Расставьте пять узлов по разным клеткам.';
 const arrays=[{values:d.shields,max:2},{values:d.sensors,max:1},{values:d.auth??[0,0,0,0,0],max:2},{values:d.backups??[0,0,0,0,0],max:1}];
 if(arrays.some(({values,max})=>!Array.isArray(values)||values.length!==5||values.some(n=>!Number.isInteger(n)||n<0||n>max)))return 'Некорректная защита узлов.';
 return arrays.reduce((sum,{values})=>sum+values.reduce((a,b)=>a+b,0),0)>4?'Доступно четыре жетона защиты.':'';
}
export type Countermeasure='ddos'|'auth'|'backup';
export const COUNTER_LABELS={ddos:'Анти-DDoS',auth:'Защита аккаунтов',backup:'Восстановление'};
export function attackCounter(card:CardId,n:NodeState,reserve:Countermeasure|'hidden'|null=null):Countermeasure|null{
 return card==='ddos'&&(n.shield>0||reserve==='ddos')?'ddos':(card==='phishing'||card==='fraud')&&(n.auth>0||reserve==='auth')?'auth':card==='operation'&&(n.backup||reserve==='backup')?'backup':null;
}
export function defenseSummary(n:NodeState):string{return `Анти-DDoS: ${n.shield}. Защита аккаунтов: ${n.auth}. Восстановление: ${n.backup?'готово':'нет'}.`;}
export const sabotageAmount=(id:NodeId,n:NodeState)=>Math.ceil(n.income*(n.access===2?1.5:1));
// Net cash advantage visible to the actor. No access to hidden state or enemy hands.
export function attackSwing(card:CardId,id:NodeId,n:NodeState,enemyMoney:number,reserve:Countermeasure|'hidden'|null=null):number{
 if(attackCounter(card,n,reserve))return -CARDS[card].money;
 if(card==='fraud')return Math.min(FRAUD_AMOUNT,enemyMoney)*2-CARDS[card].money;
 if(card==='ddos')return (n.interrupted?0:n.income)+Math.min(enemyMoney,Math.ceil(n.income/2))-CARDS[card].money;
 if(card==='operation')return (n.interrupted?0:n.income)+Math.min(enemyMoney,sabotageAmount(id,n))-CARDS[card].money;
 return -CARDS[card].money;
}
export function viewGame(g:Game,viewer:number):View{
 if(viewer!==0&&viewer!==1)throw new Error('Неизвестный игрок.');
 const me=g.players[viewer];
 const players=g.players.map((p,i):PlayerView=>({name:p.name,reserve:i===viewer||g.status==='finished'?p.reserve:p.reserve?'hidden':null,reserveRound:p.reserveRound,money:p.money,earned:p.earned,ready:p.ready,exchangeRound:i===viewer?p.exchangeRound??0:0,exchangeOptions:i===viewer?exchangeOptions(p):{},interrupted:p.interrupted,score:p.score,uptime:p.uptime,objectives:[...p.objectives],hand:i===viewer?[...p.hand]:[],handCount:p.hand.length,deckCount:p.deck.length,discardCount:p.discard.length,intel:i===viewer?[...p.intel]:[],scanned:i===viewer?[...p.scanned]:[],quiet:i===viewer?p.quiet:false,layout:Object.fromEntries(ids.filter(id=>p.nodes[id].built&&(i===viewer||me.scanned.includes(p.layout[id]))).map(id=>[id,p.layout[id]])),nodes:Object.fromEntries(ids.map(id=>{if(!p.nodes[id].built||i!==viewer&&!me.scanned.includes(p.layout[id]))return[id,null];const n={...p.nodes[id]};if(i===viewer&&!n.detected)n.access=0;if(i!==viewer)n.detected=false;return[id,n];})) as PlayerView['nodes']})) as [PlayerView,PlayerView];
 return {version:5,firstPlayer:g.firstPlayer,matchNumber:g.matchNumber,rematchVotes:[...g.rematchVotes],...(g.status==='finished'?{stats:structuredClone(g.stats)}:{}),mode:g.mode,turn:g.turn,round:g.round,ap:g.ap,status:g.status,winner:g.winner,...(g.startedAt?{startedAt:g.startedAt}:{}),...(g.resumedAt?{resumedAt:g.resumedAt}:{}),...(g.pause?{pause:{...g.pause}}:{}),...(g.finishReason?{finishReason:g.finishReason}:{}),logs:g.logs.filter(l=>l.audience==='all'||l.audience===viewer),serial:g.serial,players,viewer};
}
export function actionStatus(v:View,a:Action):ActionStatus{
 let cost=1;const fail=(reason:string):ActionStatus=>({ok:false,cost,reason,preview:''});const ok=(preview:string):ActionStatus=>({ok:true,cost,reason:'',preview});
 if(!a||typeof a!=='object')return fail('Неизвестное действие.');
 const p=v.players[v.viewer],e=v.players[1-v.viewer];
 if(a.type==='rematch'){cost=0;return v.status!=='finished'?fail('Реванш доступен после матча.'):v.rematchVotes.includes(v.viewer)?fail('Вы уже готовы к реваншу.'):ok('Начать реванш, когда оба игрока согласятся. Первым ходит другой игрок.');}
 if(a.type==='surrender'){cost=0;return v.status==='playing'||v.status==='setup'||v.status==='waiting'?ok('Завершить матч в пользу соперника.'):fail('Матч завершён.');}
 if(v.pause?.pausedAt!=null)return fail('Матч на паузе. Сначала продолжите игру.');
 if(a.type==='deploy'){cost=0;if(!['waiting','setup'].includes(v.status)||p.ready)return fail('Расстановка уже подтверждена.');const error=deploymentError(a.deployment);return error?fail(error):ok('Подтвердить расстановку.');}
 if(v.status!=='playing')return fail('Матч сейчас не идёт.');if(v.viewer!==v.turn)return fail('Сейчас ход соперника.');
 if(a.type==='end'){cost=0;return ok('Передать ход сопернику.');}
 if(a.type==='exchange'){
  cost=0;
  if(!Object.hasOwn(CARDS,a.card)||!p.hand.includes(a.card))return fail('Этой карты нет в руке.');
  if((p.exchangeRound??0)===v.round)return fail('Замена уже использована в этом ходу.');
  if(!cardKinds.includes(a.kind)||!p.exchangeOptions[a.card]?.includes(a.kind))return fail('Других карт этой категории в колоде и сбросе нет.');
  return ok('Заменить одну карту бесплатно. Один раз за ход, даже при полной руке.');
 }
 if(a.type==='card'){if(!Object.hasOwn(CARDS,a.card))return fail('Неизвестная карта.');if(!p.hand.includes(a.card))return fail('Этой карты нет в руке.');cost=CARDS[a.card].cost;if(p.money<CARDS[a.card].money)return fail(`Нужно ${CARDS[a.card].money} кредитов. В казне ${p.money}.`);}
 if(v.ap<cost)return fail(`Нужно ${cost} действия. Осталось ${v.ap}.`);
 if(a.type==='reserve'){
  if(!Object.hasOwn(COUNTER_LABELS,a.counter))return fail('Выберите тип дежурства.');
  if(p.reserveRound===v.round)return fail('Дежурство уже выбрано в этом ходу.');
  if(p.reserve===a.counter)return fail('Такое дежурство уже подготовлено и сохраняется до удара.');
  if(p.money<RESERVE_COST)return fail(`Нужно ${RESERVE_COST} кредитов.`);
  return ok(`${p.reserve?'Заменить текущее дежурство. ':''}Отразить один подходящий удар: ${COUNTER_LABELS[a.counter]}. Вся сеть, без срока действия. Сначала расходуется защита узла. Цена ${RESERVE_COST} и 1 действие.`);
 }
 if(a.type==='draw')return p.hand.length>=10?fail('Рука заполнена.'):p.deckCount===0&&p.discardCount===0?fail('Нет карт для добора.'):ok('Добрать одну карту за одно действие.');
 if(a.type==='card'&&a.card==='stealth')return p.quiet?fail('Тихий проход уже подготовлен.'):ok('Следующая атака не вызовет сигнал датчика.');
 if(a.type==='card'&&a.card==='supply')return p.hand.length>=10?fail('Сначала освободите место в руке.'):ok('Добрать две карты.');
 if(a.type==='card'&&a.card==='expand'){
  if(a.side!=='own')return fail('Выберите своё поле.');if(!Number.isInteger(a.cell)||a.cell!<0||a.cell!>=25)return fail('Выберите свободную клетку своего поля.');if(Object.values(p.layout).includes(a.cell!))return fail('Клетка уже занята.');return ids.filter(id=>id.startsWith('service')).every(id=>p.nodes[id])?fail('Построены все три дополнительных сервера.'):ok('Построить сервер: +100 к доходу за раунд. Новая цель для соперника.');
 }
 if(a.type==='scan'||a.type==='card'&&a.card==='recon'){
  if(a.side!=='enemy')return fail('Выберите поле соперника.');const area=scanArea(a.cell??-1,a.type==='card');if(!area.length)return fail('Выберите клетку для сканирования.');const count=area.filter(c=>!p.scanned.includes(c)).length;return count?ok(`Раскрыть ${count} новых клеток и типы защиты найденных узлов.`):fail('Эта область уже разведана.');
 }
 if(!('node' in a)||!a.node||!ids.includes(a.node))return fail('Выберите найденный узел.');
 if(a.side!=='own'&&a.side!=='enemy')return fail('Выберите сеть.');
 const secretWarning=e.reserve==='hidden'?' Секретное дежурство может отразить удар.':'';
 const id=a.node,own=a.side==='own',n=(own?p:e).nodes[id],kind=a.type==='card'?a.card:a.type;
 if(a.type==='card'&&CARDS[a.card].side!==a.side)return fail(CARDS[a.card].side==='own'?'Выберите свой узел.':'Выберите узел соперника.');
 if(a.type!=='card'&&!own)return fail('Выберите свой узел.');
 if(!n)return fail('Узел ещё не найден.');
 if(['entry','pivot','phishing','fraud','escalate','operation','ddos'].includes(kind)){
  if(n.isolated||n.offline)return fail('Узел отключён: доступ и сетевые переходы недоступны.');
  if(kind==='entry'){if(!NODES.find(n=>n.id===id)!.entry)return fail('Технический вход возможен через веб-сервер или рабочую станцию.');if(n.access)return fail('Доступ уже есть. Проведите саботаж или продвигайтесь дальше.');}
  if(kind==='phishing'&&!hasAccountSurface(id))return fail('Фишинг нацелен на сотрудника: найдите рабочую станцию или службу доступа.');
  if(kind==='phishing'&&n.access)return fail('Доступ уже есть. Повторный фишинг этого узла недоступен до очистки.');
  if(kind==='pivot'){if(n.access)return fail('Доступ уже получен.');if(!LINKS.some(([x,y])=>{const other=x===id?y:y===id?x:null;const source=other?e.nodes[other]:null;return source&&source.access>0&&!source.isolated&&!source.offline;}))return fail('Нужен доступ к связанному работающему узлу.');}
  if(kind==='escalate')return n.access===1?ok('Получить права администратора: штраф саботажа +50%.'):fail(n.access===2?'Права уже максимальные.':'Сначала получите обычный доступ.');
  if(kind==='operation'){
   if(n.access<1)return fail('Сначала получите доступ. Права администратора необязательны.');
   if(n.income<=0)return fail('Саботаж возможен на доходном сервере. Для кражи нужна подмена платежа на рабочей станции.');
   return ok(attackCounter('operation',n,e.reserve)?'Аварийное восстановление отразит саботаж и удалит ваш доступ. Деньги и доход соперника сохранятся.':`Саботаж: −${n.interrupted?0:n.income} дохода, −${Math.min(e.money,sabotageAmount(id,n))} из казны соперника. Отключение до ремонта.${secretWarning}`);
  }
  if(kind==='fraud'){if(id!=='workstation')return fail('Платёжная учётная запись находится на рабочей станции.');if(!n.access)return fail('Сначала получите доступ к рабочей станции.');return ok(attackCounter('fraud',n,e.reserve)?'Защита аккаунтов отразит подмену платежа и отзовёт ваш доступ.':`Украсть ${Math.min(FRAUD_AMOUNT,e.money)} кредитов. Доступ расходуется, станция продолжает работать.${secretWarning}`);}
  if(kind==='ddos'){if(!isPublicService(id)&&!n.access)return fail('Это внутренний узел. Сначала получите доступ к нему или выберите публичный сервис.');if(n.income<=0)return fail('Выберите узел, который приносит доход.');return ok(attackCounter('ddos',n,e.reserve)?'Анти-DDoS отразит удар и потеряет 1 заряд. Деньги и доход соперника сохранятся.':`DDoS: −${n.interrupted?0:n.income} дохода, −${Math.min(e.money,Math.ceil(n.income/2))} за срыв контрактов. Отключение до ремонта.${secretWarning}`);}
  if(kind==='phishing')return ok(attackCounter('phishing',n,e.reserve)?'Защита аккаунтов отразит фишинг и потеряет 1 заряд. Доступа не будет.':`Получить доступ к учётной записи. Денег не крадёт; владелец увидит сигнал входа.${secretWarning}`);
  return ok(n.income>0?'Получить доступ. Затем можно провести саботаж.':id==='workstation'?'Получить доступ. Затем можно подменить платёж или перейти к связанному узлу.':'Получить доступ к службе доступа. Затем можно перейти к связанным узлам.');
 }
 if(kind==='optimize')return n.income<=0?fail('Узел не приносит доход.'):n.upgrades>=2?fail('Сервер улучшен до максимума.'):n.offline||n.isolated?fail('Сначала восстановите сервер.'):ok('Увеличить доход этого сервера на 40 за раунд.');
 if(kind==='shield')return n.shield>=2?fail('Анти-DDoS уже имеет два заряда.'):ok('Добавить заряд против DDoS. Фишинг, подмена платежа и саботаж не блокируются.');
 if(kind==='sensor')return n.sensor?fail('Датчик уже установлен.'):ok('Поставить датчик и проверить наличие угрозы.');
 if(kind==='patch')return n.auth>=2&&!n.isolated&&!n.offline?fail('Узел исправен, защита аккаунтов максимальная.'):ok('Восстановить сервис и добавить заряд против фишинга или подмены платежа. Чужой доступ пока останется.');
 if(kind==='investigate')return n.detected?fail('Угроза уже обнаружена. Теперь очистите узел.'):ok('Проверить, есть ли скрытый доступ противника.');
 if(kind==='isolate'||kind==='segment')return n.isolated?fail('Узел уже изолирован.'):ok('Закрыть сетевые действия до восстановления. Угроза останется внутри.');
 if(kind==='cleanse')return n.detected?ok('Удалить обнаруженный доступ. Сервис не отключается.'):fail('Сначала обнаружьте угрозу расследованием или датчиком.');
 if(kind==='restore')return n.isolated||n.offline?ok('Включить узел. Неочищенный доступ противника снова заработает.'):fail('Узел уже работает.');
 if(kind==='backup')return n.backup&&!n.offline&&!n.isolated&&!n.detected?fail('Восстановление уже подготовлено. Нет обнаруженных угроз или сбоя.'):ok('Очистить доступ, восстановить сервис и подготовить защиту от следующего саботажа.');
 if(kind==='purge')return ok('Проверить узел и удалить любой чужой доступ.');
 return fail('Неизвестное действие.');
}
export function cardReadiness(v:View,card:CardId):ActionStatus & {label:string}{
 const def=CARDS[card],p=v.players[v.viewer],enemy=v.players[1-v.viewer];
 const no=(label:string,reason:string)=>({ok:false,cost:def.cost,reason,preview:'',label});
 if(v.status!=='playing')return no('Матч не идёт','Карта доступна во время матча.');
 if(v.turn!==v.viewer)return no('Ход соперника','Дождитесь своего хода.');
 if(!p.hand.includes(card))return no('Нет в руке','Этой карты нет в руке.');
 if(p.money<def.money)return no('Не хватает денег',`Нужно ${def.money} кредитов. В казне ${p.money}.`);
 if(v.ap<def.cost)return no('Не хватает действий',`Нужно ${def.cost} действия. Осталось ${v.ap}.`);
 const candidates:Action[]=def.side==='none'?[{type:'card',card}]:card==='recon'||card==='expand'?Array.from({length:25},(_,cell)=>({type:'card',card,cell,side:def.side as Side})):ids.map(node=>({type:'card',card,node,side:def.side as Side}));
 let protectedTarget:ActionStatus|null=null;
 for(const action of candidates){const result=actionStatus(v,action);if(result.ok){const n='node' in action&&action.node?enemy.nodes[action.node]:null;if(n&&def.side==='enemy'&&attackCounter(card,n,enemy.reserve))protectedTarget=result;else return {...result,label:'Можно сыграть'};}}
 if(protectedTarget)return {...protectedTarget,label:'Есть контрмера'};
 if(def.side==='none'){const result=actionStatus(v,candidates[0]);return {...result,label:'Пока недоступна'};}
 if(card==='recon')return no('Всё разведано','Все клетки уже открыты. Эту карту можно заменить.');
 if(def.side==='enemy'){
  if(!Object.values(enemy.nodes).some(Boolean))return no('Нужна разведка','Сначала найдите узел. Нажмите «Скан», затем выберите клетку и подтвердите разведку.');
  if(card==='escalate')return no('Нужен доступ','Сначала получите обычный доступ картой «Точка входа», «Фишинг» или «Боковое движение».');
  if(card==='operation')return no('Нужен доступ','Получите обычный доступ к доходному серверу. Повышение прав необязательно.');
  if(card==='fraud')return no('Нужна станция','Найдите работающую рабочую станцию и получите к ней доступ.');
  if(card==='ddos')return no('Нужна доступная цель','Найдите публичный веб-сервер или новый сервер. Для внутреннего сервера сначала получите доступ.');
  if(card==='pivot')return no('Нужен маршрут','Нужны найденная цель и доступ к связанному работающему узлу.');
  if(card==='entry'||card==='phishing')return no('Нет точки входа',card==='phishing'?'Найдите рабочую станцию или службу доступа, к которой у вас ещё нет доступа.':'Найдите работающий веб-сервер или станцию без вашего доступа.');
  return no('Нет цели','Нужен найденный работающий сервер с доходом. Можно разведать другие клетки или заменить карту.');
 }
 if(card==='expand')return no('Лимит серверов','Все три дополнительных сервера уже построены. Эту карту можно заменить.');
 if(card==='optimize')return no('Нет цели','Нужен работающий доходный сервер, у которого меньше двух улучшений.');
 return no('Нет цели','На вашей сети сейчас нет подходящего узла. Можно заменить карту.');
}
export function applyAction(input:Game,actor:number,a:Action):Game{
 const g=structuredClone(upgradeGame(input));if(actor!==0&&actor!==1)throw new Error('Неизвестный игрок.');
 const status=actionStatus(viewGame(g,actor),a);if(!status.ok)throw new Error(status.reason);
 const p=g.players[actor],enemy=g.players[1-actor];
 if(a.type==='rematch'){g.rematchVotes.push(actor);if(g.rematchVotes.length<2)return g;const next=newGame(g.mode,[g.players[0].name,g.players[1].name],g.rng);next.firstPlayer=1-g.firstPlayer;next.matchNumber=g.matchNumber+1;next.status='setup';return next;}
 if(a.type==='surrender'){delete g.pause;g.status='finished';g.finishReason='surrender';g.winner=1-actor;log(g,`${p.name} сдаётся. Побеждает ${enemy.name}.`);return g;}
 if(a.type==='deploy'){
  coreIds.forEach((id,i)=>{p.layout[id]=a.deployment.layout[i];p.nodes[id].shield=a.deployment.shields[i];p.nodes[id].sensor=!!a.deployment.sensors[i];p.nodes[id].auth=a.deployment.auth?.[i]??0;p.nodes[id].backup=!!a.deployment.backups?.[i];});p.ready=true;
  log(g,`${p.name} готов к дуэли.`);
  if(g.status!=='waiting'&&g.players.every(p=>p.ready)){g.status='playing';g.turn=g.firstPlayer;log(g,'Дуэль началась. Разведайте поле соперника.');}else if(g.mode==='local')g.turn=1;
  return g;
 }
 if(a.type==='end'){endTurn(g);return g;}
 if(a.type==='exchange'){
  const matches=(c:CardId)=>c!==a.card&&CARDS[c].kind===a.kind;
  const pile=p.deck.some(matches)?p.deck:p.discard,index=pile.findIndex(matches),replacement=pile.splice(index,1)[0];
  p.hand[p.hand.indexOf(a.card)]=replacement;p.discard.push(a.card);p.exchangeRound=g.round;
  log(g,`Замена: «${CARDS[a.card].name}» → «${CARDS[replacement].name}».`,actor);return g;
 }

 const c=a.type==='card'?a.card:null;
 if(a.type==='reserve'){p.money-=RESERVE_COST;p.reserve=a.counter;p.reserveRound=g.round;g.ap--;g.stats[actor].spent+=RESERVE_COST;g.stats[actor].defenses++;log(g,`${p.name}: подготовлено секретное дежурство до подходящего удара.`,'all','defense');log(g,`Дежурство: ${COUNTER_LABELS[a.counter]}. Один удар по всей сети.`,actor,'defense');return g;}
 if(c){p.money-=CARDS[c].money;g.stats[actor].spent+=CARDS[c].money;const category=CARDS[c].kind;g.stats[actor][category==='attack'?'attacks':category==='defense'?'defenses':'economy']++;}
 if(a.type==='draw'){draw(g,p,1);log(g,'Добрана одна карта.',actor);}
 else if(c==='stealth'){p.quiet=true;log(g,'Подготовлен тихий проход.',actor);}
 else if(c==='supply'){}
 else if(c==='expand'&&'cell' in a){const id=ids.find(id=>id.startsWith('service')&&!p.nodes[id].built)!;p.layout[id]=a.cell!;p.nodes[id].built=true;log(g,`Построен ${nameOf(id)}: +100 к доходу.`,actor,'defense');}
 else if(a.type==='scan'||c==='recon'){
  const cell=('cell' in a?a.cell:0)??0,area=scanArea(cell,!!c);let found=0;
  for(const q of area){if(!p.scanned.includes(q)){p.scanned.push(q);const id=ids.find(id=>enemy.layout[id]===q);if(id){p.intel.push(id);found++;}}}
  log(g,`${coordinate(cell)}: разведка ${area.length} клеток. Новых узлов: ${found}.`,actor);
  for(const id of ids)if(enemy.nodes[id].built&&area.includes(enemy.layout[id]))log(g,`${nameOf(id)}: ${defenseSummary(enemy.nodes[id])}`,actor);
 }else if('node' in a&&a.node){
  const id=a.node,n=(a.side==='own'?p:enemy).nodes[id],kind=c??a.type,label=`${nameOf(id)} (${coordinate((a.side==='own'?p:enemy).layout[id])})`;
  if(['entry','phishing','fraud','pivot','escalate','operation','ddos'].includes(kind)){
   const counter=attackCounter(kind as CardId,n,enemy.reserve);
   if(counter){g.stats[1-actor].blocked++;if(!attackCounter(kind as CardId,n)){enemy.reserve=null;if(counter==='backup'||kind==='fraud'){n.access=0;n.detected=false;}log(g,`${enemy.name}: дежурство отразило «${CARDS[kind as CardId].name}».`,'all','defense');g.ap-=status.cost;p.hand.splice(p.hand.indexOf(c!),1);p.discard.push(c!);return g;}}
   if(kind==='escalate'){n.access=2;log(g,`Получены права администратора: ${label}.`,actor,'attack');}
   else if(kind==='operation'){
    if(n.backup){n.backup=false;n.access=0;n.detected=false;log(g,`Аварийное восстановление отразило саботаж: ${label}. Доступ удалён, доход сохранён.`,'all','defense');}
    else{const damage=Math.min(enemy.money,sabotageAmount(id,n));enemy.money-=damage;g.stats[1-actor].cashLost+=damage;n.offline=true;n.interrupted=true;n.access=0;n.detected=false;log(g,`${p.name}: саботаж ${label}. Потеряно соперником ${damage} кредитов, сервис отключён.`,'all','attack');}
   }
   else if(kind==='ddos'){
    if(n.shield){n.shield--;log(g,`Анти-DDoS отразил удар: ${label}. Осталось зарядов: ${n.shield}.`,'all','defense');}
    else{const damage=Math.min(enemy.money,Math.ceil(n.income/2));enemy.money-=damage;g.stats[1-actor].cashLost+=damage;n.offline=true;n.interrupted=true;log(g,`${p.name}: DDoS: ${label}. Доход потерян, срыв контрактов −${damage} кредитов.`,'all','attack');}
   }
   else if(kind==='phishing'){
    if(n.auth){n.auth--;log(g,`Защита аккаунтов отразила фишинг: ${label}. Осталось зарядов: ${n.auth}.`,'all','defense');}
    else{n.access=1;n.detected=true;log(g,`${p.name}: фишинг ${label}. Получен доступ; деньги не списывались.`,'all','attack');}
   }
   else if(kind==='fraud'){
    if(n.auth){n.auth--;log(g,`Защита аккаунтов отразила подмену платежа: ${label}. Доступ отозван.`,'all','defense');}
    else{const stolen=Math.min(FRAUD_AMOUNT,enemy.money);enemy.money-=stolen;p.money+=stolen;g.stats[1-actor].cashLost+=stolen;g.stats[actor].stolen+=stolen;log(g,`${p.name}: подмена платежа ${label}. Украдено ${stolen} кредитов, доступ отозван.`,'all','attack');}
    n.access=0;n.detected=false;
   }
   else{n.access=1;log(g,`Доступ получен: ${label}.`,actor,'attack');}
   if(kind==='entry'||kind==='pivot'||kind==='escalate'){if(n.sensor&&!p.quiet){n.detected=n.access>0;log(g,`Датчик обнаружил активность: ${label}.`,1-actor,'attack');}p.quiet=false;}
  }else if(kind==='optimize'){n.upgrades++;n.income+=40;log(g,`Модернизирован ${label}: +40 к доходу.`,actor,'defense');}
  else if(kind==='shield'){n.shield++;log(g,`Добавлена защита от DDoS: ${label}.`,actor,'defense');}
  else if(kind==='patch'){n.auth=Math.min(2,n.auth+1);n.offline=false;n.isolated=false;log(g,`Защита аккаунтов усилена, сервис восстановлен: ${label}. Чужой доступ сохраняется.`,actor,'defense');}
  else if(kind==='sensor'||kind==='investigate'){if(kind==='sensor')n.sensor=true;n.detected=n.access>0;log(g,`${label}: ${n.detected?'обнаружен чужой доступ!':'следы доступа не найдены.'}`,actor,n.detected?'attack':'normal');}
  else if(kind==='isolate'||kind==='segment'){n.isolated=true;if(kind==='segment')n.auth=Math.min(2,n.auth+1);n.interrupted=true;log(g,`Изолирован ${label}. Сначала очистите угрозу, затем восстановите связь.`,actor,'defense');}
  else if(kind==='backup'||kind==='purge'||kind==='cleanse'){n.access=0;n.detected=false;if(kind==='backup'){n.offline=false;n.isolated=false;n.backup=true;}log(g,`Узел очищен: ${label}.`,actor,'defense');}
  else if(kind==='restore'){n.offline=false;n.isolated=false;log(g,`Связь восстановлена: ${label}.`,actor,'defense');}
 }
 g.ap-=status.cost;
 if(c){p.hand.splice(p.hand.indexOf(c),1);p.discard.push(c);if(c==='supply')draw(g,p,2);}
 return g;
}
export function incomeOf(p:Player|PlayerView,actual=true):number{return BASE_INCOME+Object.values(p.nodes).reduce((sum,n)=>sum+(n?.built&&(!actual||!n.offline&&!n.isolated&&!n.interrupted)?n.income:0),0);}
function endTurn(g:Game){
 if(g.turn!==g.firstPlayer){
  for(const p of g.players){const income=incomeOf(p);p.money+=income;p.earned+=income;log(g,`${p.name}: доход +${income}, в казне ${p.money}.`,'all','score');}
  if(g.players.some(p=>p.money>=MONEY_GOAL)||g.round===MAX_ROUNDS){delete g.pause;g.status='finished';g.finishReason='score';g.winner=g.players[0].money===g.players[1].money?null:g.players[0].money>g.players[1].money?0:1;log(g,g.winner===null?'Ничья.':`Побеждает компания ${g.players[g.winner].name}.`,'all','score');return;}
  g.round++;for(const p of g.players)for(const n of Object.values(p.nodes))n.interrupted=false;
 }
 g.turn=1-g.turn;g.ap=3;if(g.round>1)draw(g,g.players[g.turn],2);log(g,`Ход: ${g.players[g.turn].name}.`);
}
export function legal(g:Game,actor:number,a:Action):boolean{return actionStatus(viewGame(g,actor),a).ok;}
// Search short, executable attack chains using the same public view as a human.
// Unknown reserve types are never branched on; scores are potential outcomes, not promises.
export function planAttacks(view:View):{action:Action;swing:number;steps:number}[]{
 const plans:{action:Action;swing:number;steps:number}[]=[];
 const walk=(v:View,first:Action|null,spent:number,depth:number)=>{
  const enemy=v.players[1-v.viewer];
  for(const node of ids){const n=enemy.nodes[node];if(!n)continue;
   for(const card of ['ddos','operation','fraud'] as CardId[]){
    const action:Action={type:'card',card,node,side:'enemy'};
    if(!actionStatus(v,action).ok||attackCounter(card,n,enemy.reserve))continue;
    const swing=attackSwing(card,node,n,enemy.money,enemy.reserve)-spent;
    if(swing>0)plans.push({action:first??action,swing,steps:depth+1});
   }
   if(depth>=2||v.ap<2)continue;
   for(const card of ['entry','pivot','phishing','escalate','ddos'] as CardId[]){
    const action:Action={type:'card',card,node,side:'enemy'};
    if(!actionStatus(v,action).ok)continue;
    // DDoS may clear a local charge; other damage actions are terminal.
    if(card==='ddos'&&!n.shield)continue;
    const next=structuredClone(v),target=next.players[1-v.viewer].nodes[node]!,player=next.players[v.viewer];
    player.money-=CARDS[card].money;player.hand.splice(player.hand.indexOf(card),1);next.ap--;
    if(card==='ddos')target.shield--;
    else if(card==='phishing'&&target.auth)target.auth--;
    else if(card==='escalate')target.access=2;
    else target.access=1;
    walk(next,first??action,spent+CARDS[card].money,depth+1);
   }
  }
 };
 if(view.status==='playing'&&view.turn===view.viewer&&view.ap>0)walk(view,null,0,0);
 return plans.sort((a,b)=>b.swing/b.steps-a.swing/a.steps);
}
export function botAction(input:Game|View):Action{
 const v='viewer' in input?input:viewGame(input,input.turn),p=v.players[v.viewer],e=v.players[1-v.viewer];
 const ownIncome=incomeOf(p);
 // Unknown nodes and opponent cards never enter this policy.
 const enemyIncome=BASE_INCOME+ids.reduce((sum,id)=>{const n=e.nodes[id];return sum+(n?n.offline||n.isolated||n.interrupted?0:n.income:coreIds.includes(id)?defaultIncome(id):0);},0);
 const horizon=Math.max(1,Math.min(MAX_ROUNDS-v.round+1,Math.ceil((MONEY_GOAL-p.money)/Math.max(1,ownIncome)),Math.ceil((MONEY_GOAL-e.money)/Math.max(1,enemyIncome))));
 const winNow=p.money+ownIncome>=MONEY_GOAL&&p.money+ownIncome>e.money+enemyIncome;
 const recent=v.logs.filter(l=>l.round>=v.round-1&&l.tone==='attack'&&(l.audience===v.viewer||l.audience==='all'&&!l.text.startsWith(p.name+':')));
 const ddosPressure=recent.some(l=>l.text.includes('DDoS:')),phishPressure=recent.some(l=>l.text.includes('фишинг'));
 const options:{action:Action;value:number}[]=[];
 const add=(action:Action,value:number)=>{if(actionStatus(v,action).ok)options.push({action,value});};
 const spending=(value:number,cost:number)=>winNow&&p.money-cost+ownIncome<Math.max(MONEY_GOAL,e.money+enemyIncome)?-1:value;
 for(const plan of planAttacks(v)){const cost=plan.action.type==='card'?CARDS[plan.action.card].money:0;add(plan.action,spending(plan.swing/(15*plan.steps),cost));}
 for(const card of new Set(p.hand))if(!cardReadiness(v,card).ok){
  const priorities:CardKind[]=Object.values(p.nodes).some(n=>n?.detected)?['defense','economy','attack']:horizon>2?['economy','attack','defense']:['attack','defense','economy'];
  for(let i=0;i<priorities.length;i++)add({type:'exchange',card,kind:priorities[i]},1.4-i*.2);
 }
 for(const c of new Set(p.hand)){
  const price=CARDS[c].money;
  if(c==='expand'){for(let cell=0;cell<25;cell++)add({type:'card',card:c,cell,side:'own'},spending((horizon*100-price)/20,price));continue;}
  if(c==='recon'){for(let cell=0;cell<25;cell++)add({type:'card',card:c,cell,side:'enemy'},spending(scanArea(cell,true).filter(n=>!p.scanned.includes(n)).length*.26-price/50,price));continue;}
  if(CARDS[c].side==='none'){add({type:'card',card:c},c==='supply'&&p.hand.length<5&&horizon>1?1.3:-1);continue;}
  for(const node of ids){
   const n=e.nodes[node],own=p.nodes[node];let value=-1;
   if((c==='operation'||c==='fraud'||c==='ddos')&&n){
    value=attackSwing(c,node,n,e.money,e.reserve)/15;
    // Breaking a counter only pays if enough matching cards and AP remain.
    if(c==='ddos'&&n.shield>0){
     const charges=n.shield,copies=p.hand.filter(x=>x===c).length;
     value=copies>charges&&v.ap>charges?(attackSwing(c,node,{...n,shield:0,auth:0},e.money)-charges*price)/20:-1;
    }
   }
   if(c==='optimize')value=(horizon*40-price)/20;
   if(c==='purge')value=own?.detected&&(!own.backup||node==='workstation')?7:-1;
   if(c==='backup')value=own?.detected&&(!own.backup||node==='workstation')?9:own&&(own.offline||own.isolated)?6:-1;
   if(c==='patch')value=own&&(own.offline||own.isolated)?7:own&&hasAccountSurface(node)&&own.auth===0&&horizon>1&&phishPressure?2:-1;
   if(c==='shield')value=own&&own.income>=100&&own.shield===0&&horizon>1&&ddosPressure?2:-1;
   if(c==='sensor')value=own&&!own.sensor&&own.income>=100&&recent.length&&horizon>1?.5:-1;
   if(c==='segment')value=own?.detected&&v.ap===1&&own.income===0?2:-1;
   add({type:'card',card:c,node,side:CARDS[c].side as Side},spending(value,price));
  }
 }
 for(const node of ids){const n=p.nodes[node];if(!n)continue;
  if(n.detected&&(!n.backup||node==='workstation'))add({type:'cleanse',node,side:'own'},n.income>0||node==='workstation'?9:4);
  if(n.detected&&!n.backup&&v.ap===1)add({type:'isolate',node,side:'own'},n.income===0?5:-1);
  if(n.offline||n.isolated)add({type:'restore',node,side:'own'},n.detected?-.5:7+n.income/100);
 }
 if(!winNow&&horizon>1&&p.money>=RESERVE_COST+100){const counter=phishPressure?'auth':ddosPressure?'ddos':null;if(counter)add({type:'reserve',counter},4);}
 for(let cell=0;cell<25;cell++)add({type:'scan',cell,side:'enemy'},scanArea(cell).filter(n=>!p.scanned.includes(n)).length*.2);
 add({type:'draw'},p.hand.length<7?1:.1);
 if(winNow)add({type:'end'},15);
 options.sort((a,b)=>b.value-a.value);return options[0]?.value>0?options[0].action:{type:'end'};
}
