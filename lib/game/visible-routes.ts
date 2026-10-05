import {LINKS,NODES,actionStatus,coordinate,type CardId,type NodeId,type Side,type View} from './engine.ts';

export type RouteSelection={cell:number;side:Side}|null;
export type VisibleRoute={
 from:NodeId;to:NodeId;fromCell:number;toCell:number;
 state:'connected'|'available'|'blocked';
};

/** Works only with the recipient's masked view. A known node type never reveals its hidden position. */
export function visibleRoutes(view:View,side:Side,selection:RouteSelection,card:CardId|null):VisibleRoute[]{
 const me=view.players[view.viewer],player=view.players[side==='own'?view.viewer:1-view.viewer];
 const visible=(id:NodeId)=>{
  const cell=player.layout[id];
  return player.nodes[id]?.built&&Number.isInteger(cell)&&cell!>=0&&cell!<25&&(side==='own'||me.scanned.includes(cell!));
 };
 const selected=selection?.side===side?NODES.find(n=>visible(n.id)&&player.layout[n.id]===selection.cell)?.id:null;
 const pivot=side==='enemy'&&card==='pivot';
 return LINKS.flatMap(([a,b]):VisibleRoute[]=>{
  if(!visible(a)||!visible(b))return [];
  const left=player.nodes[a]!,right=player.nodes[b]!;
  const source=pivot?(left.access>0&&right.access===0?a:right.access>0&&left.access===0?b:null):null;
  const target=source===a?b:a;
  const broken=left.isolated||left.offline||right.isolated||right.offline;
  const available=!!source&&!broken&&actionStatus(view,{type:'card',card:'pivot',side:'enemy',node:target}).ok;
  // Without a selected node, movement only displays an actual usable route or a visibly broken one.
  if(selected?a!==selected&&b!==selected:!pivot||!source||!available&&!broken)return [];
  const from=source??(selected===b?b:a),to=from===a?b:a;
  return [{from,to,fromCell:player.layout[from]!,toCell:player.layout[to]!,state:broken?'blocked':available?'available':'connected'}];
 });
}

export function routeDescription(route:VisibleRoute):string{
 const name=(id:NodeId)=>NODES.find(n=>n.id===id)!.name;
 const state=route.state==='available'?'доступный переход':route.state==='blocked'?'связь разорвана: узел отключён или изолирован':'сетевая связь';
 return `${name(route.from)} ${coordinate(route.fromCell)} → ${name(route.to)} ${coordinate(route.toCell)}: ${state}.`;
}

export function routeHint(view:View,side:Side,selection:RouteSelection,card:CardId|null,routes:VisibleRoute[]):string{
 const available=routes.filter(route=>route.state==='available'),broken=routes.some(route=>route.state==='blocked');
 if(available.length===1)return `${coordinate(available[0].fromCell)} → ${coordinate(available[0].toCell)} · доступный переход`;
 if(available.length)return `→ доступных переходов: ${available.length}${broken?' · ⋯ разорвано':''}`;
 if(routes.length)return broken?'Линия — связь · ⋯ узел отключён':'Линия — связь, а не соседство клеток';
 if(card==='pivot'&&side==='enemy'){
  const player=view.players[1-view.viewer];
  const selected=selection?.side===side?NODES.find(n=>player.layout[n.id]===selection.cell&&view.players[view.viewer].scanned.includes(selection.cell)&&player.nodes[n.id]):null;
  if(selected)return actionStatus(view,{type:'card',card:'pivot',node:selected.id,side:'enemy'}).reason||'Нет известных маршрутов';
  return 'Нужны найденная цель и доступ к связанному узлу';
 }
 return selection?.side===side?'Нет известных связей с найденными узлами':side==='own'?'Выберите узел — покажем его связи':'Маршруты видны между найденными узлами';
}
