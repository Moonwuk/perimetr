import {CARDS,type CardId} from './engine.ts';
import {ONLINE_ENABLED,ONLINE_ORIGIN} from './platform.ts';

type MetricsSession={code:string;token:string};
export type CardDragMetric={card:CardId;outcome:'submitted'|'cancelled'|'invalid';durationMs?:number};
type DragEvent={type:'card_drag'}&CardDragMetric;
export const METRICS_BATCH_SIZE=10;
export const METRICS_QUEUE_LIMIT=40;
const isCard=(card:unknown):card is CardId=>typeof card==='string'&&Object.hasOwn(CARDS,card);
function sanitizeDrag(input:unknown):DragEvent|null{
 if(!input||typeof input!=='object')return null;
 const data=input as Record<string,unknown>;
 if(!isCard(data.card)||!['submitted','cancelled','invalid'].includes(data.outcome as string))return null;
 const event:DragEvent={type:'card_drag',card:data.card,outcome:data.outcome as CardDragMetric['outcome']};
 if(typeof data.durationMs==='number'&&Number.isFinite(data.durationMs)&&data.durationMs>=0)event.durationMs=Math.min(60000,Math.round(data.durationMs));
 return event;
}

/** Only optional drag diagnostics use this client. Match results are collected by the server. */
export function createMetricsClient(options:{origin?:string;enabled?:boolean;fetch?:typeof fetch;delayMs?:number}={}){
 let session:MetricsSession|null=null,queue:DragEvent[]=[],timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined,generation=0,sending=false;
 const fetcher=options.fetch??((...args:Parameters<typeof fetch>)=>fetch(...args));
 const clearTimer=()=>{if(timer!==undefined){clearTimeout(timer);timer=undefined;}};
 function configureMetricsSession(next:MetricsSession|null){
  if(session?.code===next?.code&&session?.token===next?.token)return;
  generation++;clearTimer();controller?.abort();controller=undefined;sending=false;queue=[];
  session=next&&typeof next.code==='string'&&typeof next.token==='string'?{code:next.code,token:next.token}:null;
 }
 function schedule(){if(timer!==undefined||sending||!queue.length||!session)return;timer=setTimeout(()=>{timer=undefined;void flushMetrics();},options.delayMs??1000);}
 async function flushMetrics():Promise<void>{
  clearTimer();if(!session||sending||!queue.length||options.enabled===false)return;
  const current=session,epoch=generation,batch=queue.splice(0,METRICS_BATCH_SIZE),abort=new AbortController();controller=abort;sending=true;
  const timeout=setTimeout(()=>abort.abort(),4000);
  try{
   // Room credentials are restricted to Authorization; no game state, names or layouts are sent.
   // A failed diagnostic batch is dropped, never retried or coupled to a paid game action.
   await fetcher(`${options.origin??''}/api/metrics`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${current.token}`},body:JSON.stringify({code:current.code,events:batch}),signal:abort.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
  }catch{/* Diagnostics must never block or reject a game action. */}
  finally{clearTimeout(timeout);if(epoch===generation){controller=undefined;sending=false;schedule();}}
 }
 function trackMetric(kind:'card_drag',data:CardDragMetric){
  if(kind!=='card_drag'||options.enabled===false||!session)return;
  const event=sanitizeDrag(data);if(!event)return;
  if(queue.length===METRICS_QUEUE_LIMIT)queue.shift();queue.push(event);
  if(queue.length>=METRICS_BATCH_SIZE&&!sending)void flushMetrics();else schedule();
 }
 return {configureMetricsSession,trackMetric,flushMetrics};
}
// Bounded memory only. Closing/changing a room discards pending diagnostics and credentials.
const client=createMetricsClient({origin:ONLINE_ORIGIN,enabled:ONLINE_ENABLED});
export const {configureMetricsSession,trackMetric}=client;
