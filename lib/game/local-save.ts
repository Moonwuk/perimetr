import {upgradeGame,viewGame,type Game} from './engine.ts';
export const LOCAL_SAVE_KEY='contour-local-v4';
export function decodeLocalSave(raw:string|null):Game|null{
 if(!raw||raw.length>256000)return null;
 try{
  const g=JSON.parse(raw);
  if(g.version!==4||!['bot','local'].includes(g.mode)||!['setup','playing','finished'].includes(g.status)||!Array.isArray(g.players)||g.players.length!==2||![0,1].includes(g.turn)||!Number.isInteger(g.round)||g.round<1||g.round>13||!Number.isInteger(g.ap)||g.ap<0||g.ap>3)return null;
  const upgraded=upgradeGame(g);viewGame(upgraded,0);viewGame(upgraded,1);return upgraded;
 }catch{return null;}
}
