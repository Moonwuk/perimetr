export const IS_ANDROID=typeof document!=='undefined'&&document.documentElement.dataset.platform==='android';
const configured=(globalThis as {__PERIMETER_ONLINE_ORIGIN__?:string}).__PERIMETER_ONLINE_ORIGIN__||'';
export const ONLINE_ORIGIN=IS_ANDROID?configured:'';
export const ONLINE_ENABLED=!IS_ANDROID||!!ONLINE_ORIGIN;
export function nativeMessage(type:'matchFinished'|'checkUpdates'|'gameState',payload:Record<string,unknown>={}){
  const bridge=(globalThis as {PerimeterBridge?:{postMessage:(s:string)=>void}}).PerimeterBridge;
  bridge?.postMessage(JSON.stringify({type,...payload}));
}
