import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {ANDROID_APP_ORIGIN,apiPreflight,isAllowedApiOrigin,withApiCors} from '../lib/server/api-origin.ts';
const base='https://game.test';
const request=(path='/api/rooms',method='GET',origin=ANDROID_APP_ORIGIN,extra={})=>new Request(base+path,{method,headers:{...(origin===undefined?{}:{Origin:origin}),...extra}});
const preflight=(path='/api/rooms',method='POST',headers='authorization, content-type',origin=ANDROID_APP_ORIGIN)=>request(path,'OPTIONS',origin,{'Access-Control-Request-Method':method,'Access-Control-Request-Headers':headers});
const source=(await readFile(new URL('../cloudflare/worker.ts',import.meta.url),'utf8'))
 .replace("import {GET,handleRoomPost} from '../app/api/rooms/route';",'const GET=()=>globalThis.__corsHandler();const handleRoomPost=async(request,admission)=>await admission()?globalThis.__corsHandler():Response.json({error:"limited"},{status:429,headers:{"Retry-After":"60"}});')
 .replace("import {POST as ingestMetrics,handleMetricsExport} from '../app/api/metrics/route';",'const ingestMetrics=()=>globalThis.__corsHandler();const handleMetricsExport=()=>globalThis.__corsHandler();')
 .replace("import {cleanupMetrics} from '../lib/server/metrics';",'const cleanupMetrics=async()=>{};')
 .replace("'../lib/server/api-origin'",JSON.stringify(new URL('../lib/server/api-origin.ts',import.meta.url).href));
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
let apiAllowed=true,admissionAllowed=true,apiChecks=0,admissionChecks=0,dispatches=0,status=200,throws=false;
globalThis.__corsHandler=async()=>{dispatches++;if(throws)throw Error('test route failure');return Response.json({ok:status===200},{status,headers:status===429?{'Retry-After':'60'}:{}});};
const env={DB:{prepare:()=>({first:async()=>null})},ASSETS:{fetch:async()=>new Response('asset')},API_LIMITER:{limit:async()=>{apiChecks++;return {success:apiAllowed};}},ADMISSION_LIMITER:{limit:async()=>{admissionChecks++;return {success:admissionAllowed};}}};
const cors=response=>{assert.equal(response.headers.get('Access-Control-Allow-Origin'),ANDROID_APP_ORIGIN);assert.equal(response.headers.get('Access-Control-Allow-Credentials'),null);assert(response.headers.get('Vary')?.split(/,\s*/).includes('Origin'));};
test('the exact Android origin only gets room, diagnostic and health methods',()=>{
 for(const [path,method] of [['/api/rooms','GET'],['/api/rooms','POST'],['/api/metrics','POST'],['/api/health','GET']])assert(isAllowedApiOrigin(request(path,method)));
 for(const [path,method] of [['/api/metrics','GET'],['/api/metrics/export','GET'],['/api/rooms','DELETE'],['/api/health','POST'],['/api/not-found','GET']])assert(!isAllowedApiOrigin(request(path,method)));
 for(const origin of ['null','http://appassets.androidplatform.net','https://appassets.androidplatform.net.evil.test','https://evil.test','https://sub.appassets.androidplatform.net'])assert(!isAllowedApiOrigin(request('/api/rooms','POST',origin)));
 assert(isAllowedApiOrigin(request('/api/metrics/export','GET',base)));
 assert(isAllowedApiOrigin(new Request(base+'/api/metrics/export')));
});
test('preflight permits only Authorization and Content-Type and has a bounded cache',()=>{
 const incoming=preflight(),response=withApiCors(incoming,apiPreflight(incoming));assert.equal(response.status,204);cors(response);
 assert.equal(response.headers.get('Access-Control-Allow-Methods'),'GET, POST');assert.equal(response.headers.get('Access-Control-Allow-Headers'),'Authorization, Content-Type');assert.equal(response.headers.get('Access-Control-Max-Age'),'600');
 assert(response.headers.get('Vary').includes('Access-Control-Request-Headers'));assert(response.headers.get('Vary').includes('Access-Control-Request-Method'));
 for(const incoming of [preflight('/api/rooms','DELETE'),preflight('/api/rooms','POST','x-admin'),preflight('/api/metrics/export','GET'),preflight('/api/rooms','POST','authorization','https://evil.test')])assert.equal(apiPreflight(incoming).status,403);
});
test('Worker preflight stops before room admission and database writes',async()=>{
 const checks=apiChecks,admissions=admissionChecks,calls=dispatches;
 const response=await worker.fetch(preflight(),env);assert.equal(response.status,204);cors(response);
 assert.equal(apiChecks,checks+1);assert.equal(admissionChecks,admissions);assert.equal(dispatches,calls);
});
test('all allowed Android error responses retain CORS, including rate limits and unexpected failures',async()=>{
 for(const errorStatus of [400,403,404,409,429,503]){status=errorStatus;const response=await worker.fetch(request('/api/rooms','GET'),env);assert.equal(response.status,errorStatus);cors(response);}
 status=200;apiAllowed=false;let response=await worker.fetch(request('/api/rooms','POST'),env);assert.equal(response.status,429);cors(response);assert.equal(response.headers.get('Retry-After'),'60');assert.equal(response.headers.get('Access-Control-Expose-Headers'),'Retry-After');apiAllowed=true;
 admissionAllowed=false;response=await worker.fetch(request('/api/rooms','POST'),env);assert.equal(response.status,429);cors(response);admissionAllowed=true;
 throws=true;try{response=await worker.fetch(request('/api/rooms','GET'),env);assert.equal(response.status,503);cors(response);}finally{throws=false;}
});
test('foreign origins and Android owner export are rejected before any route handler',async()=>{
 const calls=dispatches;
 for(const incoming of [request('/api/rooms','GET','https://evil.test'),request('/api/metrics','POST','https://evil.test'),request('/api/metrics/export','GET'),preflight('/api/rooms','POST','authorization','https://evil.test')]){const response=await worker.fetch(incoming,env);assert.equal(response.status,403);assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);}
 assert.equal(dispatches,calls);
 const web=await worker.fetch(request('/api/rooms','GET',base),env);assert.equal(web.status,200);assert.equal(web.headers.get('Access-Control-Allow-Origin'),null);
});
