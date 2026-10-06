import {english} from './locales/en.ts';
export type Language='ru'|'en';
const STORAGE_KEY='perimeter-language';
let language:Language='ru';
const listeners=new Set<()=>void>();
try{if(typeof localStorage!=='undefined'&&localStorage.getItem(STORAGE_KEY)==='en')language='en';}catch{/* Private browsing can deny storage. */}
export const getLanguage=()=>language;
export const subscribeLanguage=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
function applyDocumentLanguage(){if(typeof document==='undefined')return;document.documentElement.lang=language;document.title=language==='en'?'CONTOUR — cyber duel':'КОНТУР — кибердуэль';}
export function setLanguage(next:Language){
 if(next!=='ru'&&next!=='en')return;
 language=next;try{localStorage.setItem(STORAGE_KEY,next);}catch{/* Language still works without persistence. */}
 applyDocumentLanguage();for(const listener of listeners)listener();
}
if(typeof window!=='undefined'){
 applyDocumentLanguage();
 window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY){language=event.newValue==='en'?'en':'ru';applyDocumentLanguage();for(const listener of listeners)listener();}});
}
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const entries=Object.entries(english);
// Existing servers send Russian messages. Match their full templates at the
// presentation boundary, so different languages never alter actions or saves.
const templates=entries.filter(([key])=>/\{\d+\}/.test(key)).sort((a,b)=>b[0].replace(/\{\d+\}/g,'').length-a[0].replace(/\{\d+\}/g,'').length).map(([key,value])=>{
 const slots:number[]=[];let source='',cursor=0;
 for(const match of key.matchAll(/\{(\d+)\}/g)){source+=escape(key.slice(cursor,match.index))+'(.*?)';slots.push(Number(match[1]));cursor=match.index!+match[0].length;}
 return {pattern:new RegExp('^'+source+escape(key.slice(cursor))+'$','u'),slots,value};
});
const phrases=entries.filter(([key])=>!key.includes('{')).sort((a,b)=>b[0].length-a[0].length);
const cache=new Map<string,string>();
function englishText(text:string,depth=0):string{
 if(!/[А-Яа-яЁё]/.test(text))return text;
 const key=text.replace(/\s+/g,' ').trim();
 const prefix=text.match(/^\s*/)?.[0]??'',suffix=text.match(/\s*$/)?.[0]??'';
 if(english[key])return prefix+english[key]+suffix;
 if(depth<5)for(const {pattern,slots,value} of templates){const match=pattern.exec(key);if(!match)continue;
  const values=new Map(slots.map((slot,i)=>[slot,englishText(match[i+1],depth+1)]));
  return prefix+value.replace(/\{(\d+)\}/g,(_,slot)=>values.get(Number(slot))??'')+suffix;
 }
 // Legacy journals and accessible labels concatenate several complete messages.
 // Translate known phrases only; unknown/player-authored text is preserved.
 let result=text;
 for(const [ru,en] of phrases){if(!result.includes(ru))continue;const boundary=new RegExp(`(?<![А-Яа-яЁё])${escape(ru)}(?![А-Яа-яЁё])`,'gu');result=result.replace(boundary,()=>en);}
 return result;
}
export function translateText(value:string,locale:Language=language):string{
 if(locale==='ru')return value;
 const hit=cache.get(value);if(hit!==undefined)return hit;
 const translated=englishText(value);if(cache.size>4000)cache.clear();cache.set(value,translated);return translated;
}
/** Translate text at render sites; React elements, numbers and events are untouched. */
export function t<T>(value:T):T{
 if(typeof value==='string')return translateText(value) as T;
 if(Array.isArray(value))return value.map(item=>t(item)) as T;
 return value;
}
/** Names are player data, never translate them inside historical server messages. */
export function translateJournal(text:string,names:string[]):string{
 if(language==='ru')return text;
 const saved:string[]=[];
 for(const name of [...new Set(names)].filter(Boolean).sort((a,b)=>b.length-a.length))text=text.replaceAll(name,()=>`⟦USER${saved.push(name)-1}⟧`);
 return translateText(text).replace(/⟦USER(\d+)⟧/g,(_,index)=>saved[Number(index)]??'');
}
