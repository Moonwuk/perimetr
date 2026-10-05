// Android serves bundled assets from WebViewAssetLoader's HTTPS origin.
// No wildcard/subdomain matching and no cookie-based cross-origin requests.
export const ANDROID_APP_ORIGIN='https://appassets.androidplatform.net';
function androidMethods(path:string):string[]{
 if(path==='/api/rooms')return ['GET','POST'];
 if(path==='/api/metrics')return ['POST'];
 if(path==='/api/health')return ['GET'];
 return [];
}
export function isAllowedApiOrigin(request:Request):boolean{
 const url=new URL(request.url),origin=request.headers.get('origin');
 if(!origin||origin===url.origin)return true;
 const method=request.method==='OPTIONS'?request.headers.get('access-control-request-method')??'':request.method;
 return origin===ANDROID_APP_ORIGIN&&androidMethods(url.pathname).includes(method);
}
export function apiPreflight(request:Request):Response{
 const url=new URL(request.url),origin=request.headers.get('origin');
 const denied=()=>Response.json({error:'Недопустимый предварительный запрос.'},{status:403,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 if(!origin||!isAllowedApiOrigin(request))return denied();
 const requested=request.headers.get('access-control-request-method')??'';
 const methods=origin===ANDROID_APP_ORIGIN?androidMethods(url.pathname):url.pathname==='/api/rooms'||url.pathname==='/api/metrics'?['GET','POST']:url.pathname==='/api/health'||url.pathname==='/api/metrics/export'?['GET']:[];
 const headers=(request.headers.get('access-control-request-headers')??'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
 if(!methods.includes(requested)||headers.some(name=>name!=='authorization'&&name!=='content-type'))return denied();
 return new Response(null,{status:204,headers:{'Access-Control-Allow-Methods':methods.join(', '),'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600','Cache-Control':'no-store'}});
}
export function withApiCors(request:Request,response:Response):Response{
 const headers=new Headers(response.headers),vary=headers.get('Vary')?.split(',').map(value=>value.trim()).filter(Boolean)??[];
 if(!vary.some(value=>value.toLowerCase()==='origin'))vary.push('Origin');
 headers.set('Vary',vary.join(', '));
 if(request.method==='OPTIONS'){
  headers.append('Vary','Access-Control-Request-Method');
  headers.append('Vary','Access-Control-Request-Headers');
 }
 if(request.headers.get('origin')===ANDROID_APP_ORIGIN&&isAllowedApiOrigin(request)){
  headers.set('Access-Control-Allow-Origin',ANDROID_APP_ORIGIN);
  headers.set('Access-Control-Expose-Headers','Retry-After');
 }
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
