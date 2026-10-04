import {GET,handleRoomPost} from '../app/api/rooms/route';

type Limiter={limit:(options:{key:string})=>Promise<{success:boolean}>};
export type Env={DB:D1Database;ASSETS:Fetcher;API_LIMITER:Limiter;ADMISSION_LIMITER:Limiter};
const apiJson=(body:unknown,status=200,extra:Record<string,string>={})=>Response.json(body,{status,headers:{
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...extra,
}});

const worker = {
 async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  try{
   // Cloudflare sets this header at the edge. No IP is persisted in the game DB.
   const ip=request.headers.get('CF-Connecting-IP')||'local-development';
   if(!(await env.API_LIMITER.limit({key:`perimeter:${ip}`})).success)return apiJson({error:'Слишком много запросов. Подождите минуту.'},429,{'Retry-After':'60'});
   if(url.pathname==='/api/health'){
    if(request.method!=='GET')return apiJson({error:'Метод не поддерживается.'},405,{Allow:'GET'});
    await env.DB.prepare('SELECT code FROM rooms LIMIT 1').first();
    return apiJson({ok:true,game:'perimeter',version:'0.5.0',storage:'ready'});
   }
   if(url.pathname!=='/api/rooms')return apiJson({error:'Маршрут не найден.'},404);
   if(request.method==='GET')return GET(request);
   if(request.method==='POST')return handleRoomPost(request,async()=>{
    const result=await env.ADMISSION_LIMITER.limit({key:`perimeter-admission:${ip}`});return result.success;
   });
   return apiJson({error:'Метод не поддерживается.'},405,{Allow:'GET, POST'});
  }catch{
   console.error('perimeter_api_unavailable');
   return apiJson({error:'Сервис временно недоступен. Повторите попытку.'},503);
  }
 },
 async scheduled(_event:ScheduledController,env:Env):Promise<void>{
  await env.DB.prepare('DELETE FROM rooms WHERE expires_at <= ?').bind(Date.now()).run();
 },
};

export default worker;
