/** Standard combines every mechanic. Older identifiers only preserve saved matches. */
export const RULESETS = {
 standard: {name:'Правила партии',description:'Единая партия: публичные и внутренние сервисы, контракты, сегментация, подготовленный саботаж и приманки.'},
 baseline: {name:'Обычные правила 0.5.1',description:'Контрольная версия для сравнения. Новые механики выключены.'},
 services: {name:'A · Профили сервисов',description:'Новый сервер: публичный (+120) или внутренний (+80). Внутренний подключается к одному выбранному основному узлу.'},
 contracts: {name:'B · Открытый контракт',description:'Вложите 80 кредитов в работающий сервер. Два полных раунда без простоя принесут 220. Один контракт одновременно, каждый сервер — один раз.'},
 segmentation: {name:'C · Сегментация',description:'Закройте одну связь за 20 кредитов и 1 действие. Переход по ней запрещён; доход компании уменьшается на 20 за раунд. Открыть — 1 действие.'},
 preparation: {name:'D · Подготовленный саботаж',description:'Саботаж сначала даёт защитнику сигнал. Завершите его отдельным действием на следующем своём ходу, если доступ сохранился. Штраф удвоен.'},
 decoy: {name:'E · Сервер-приманка',description:'Карта нового сервера может создать одну приманку без дохода. Вход тратит темп, но не даёт доступ. Карта разведки распознаёт приманку заранее.'},
} as const;
export type Ruleset=keyof typeof RULESETS;
export type Mechanic='services'|'contracts'|'segmentation'|'preparation'|'decoy';
export const hasMechanic=(ruleset:Ruleset|undefined,mechanic:Mechanic)=>ruleset==='standard'||ruleset===mechanic;
export type ServiceProfile='public'|'internal'|'decoy';
export const isRuleset=(value:unknown):value is Ruleset=>typeof value==='string'&&Object.hasOwn(RULESETS,value);
export const CONTRACT_COST=80,CONTRACT_REWARD=220,SEGMENT_COST=20,SEGMENT_PENALTY=20;
export const PLAYTEST_QUESTIONS=[
 'Где было непонятно, что можно сделать?', 'Какое решение было самым интересным?',
 'Была ли рука, из которой не хотелось играть ни одной карты?', 'Защита помогала или ощущалась как налог?',
 'Было понятно, почему атака прошла или была отражена?', 'Когда стал понятен план соперника?',
 'В каком раунде исход показался предрешённым?',
];
