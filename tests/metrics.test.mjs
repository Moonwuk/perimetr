import test from 'node:test';
import assert from 'node:assert/strict';
import {createMetricsClient,METRICS_BATCH_SIZE,METRICS_QUEUE_LIMIT} from '../lib/game/metrics.ts';

const seat={code:'ABC123',token:'private-seat-token'};
const response=()=>Promise.resolve(new Response(null,{status:202}));
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('diagnostics stay disabled without an online room and never require browser storage',async()=>{
 let calls=0;
 const client=createMetricsClient({fetch:async()=>{calls++;return new Response();}});
 client.trackMetric('card_drag',{card:'ddos',outcome:'submitted'});
 await client.flushMetrics();assert.equal(calls,0);
 const disabled=createMetricsClient({enabled:false,fetch:async()=>{calls++;return new Response();}});
 disabled.configureMetricsSession(seat);disabled.trackMetric('card_drag',{card:'ddos',outcome:'submitted'});
 await disabled.flushMetrics();assert.equal(calls,0);disabled.configureMetricsSession(null);
});

test('a cloud batch contains only validated drag fields; credentials remain in the header',async()=>{
 const requests=[];
 const client=createMetricsClient({origin:'https://game.example',delayMs:60000,fetch:async(url,options)=>{requests.push({url,...options});return new Response(null,{status:202});}});
 client.configureMetricsSession(seat);
 client.trackMetric('card_drag',{card:'ddos',outcome:'submitted',durationMs:64000,token:'leak',name:'player',hand:['expand'],layout:[1,2],url:'private-url',message:'raw exception'});
 client.trackMetric('card_drag',{card:'unknown',outcome:'invalid'});
 client.trackMetric('card_drag',{card:'shield',outcome:'raw exception'});
 client.trackMetric('card_drag',{card:'shield',outcome:'cancelled',durationMs:Infinity});
 await client.flushMetrics();client.configureMetricsSession(null);
 assert.equal(requests.length,1);assert.equal(requests[0].url,'https://game.example/api/metrics');
 assert.deepEqual(JSON.parse(requests[0].body),{code:seat.code,events:[{type:'card_drag',card:'ddos',outcome:'submitted',durationMs:60000},{type:'card_drag',card:'shield',outcome:'cancelled'}]});
 assert.equal(requests[0].headers.Authorization,`Bearer ${seat.token}`);
 assert(!requests[0].body.includes(seat.token));assert.equal(requests[0].credentials,'omit');assert.equal(requests[0].referrerPolicy,'no-referrer');
});

test('slow networks bound pending diagnostics and every request contains at most ten events',async()=>{
 const batches=[];let release;
 const client=createMetricsClient({delayMs:60000,fetch:async(_url,options)=>{batches.push(JSON.parse(options.body).events);if(batches.length===1)await new Promise(resolve=>{release=resolve;});return new Response(null,{status:202});}});
 client.configureMetricsSession(seat);
 for(let i=0;i<100;i++)client.trackMetric('card_drag',{card:'ddos',outcome:'cancelled',durationMs:i});
 assert.equal(batches.length,1);assert.equal(batches[0].length,METRICS_BATCH_SIZE);
 release();await tick();
 for(let i=0;i<5;i++)await client.flushMetrics();
 client.configureMetricsSession(null);
 assert(batches.every(batch=>batch.length<=METRICS_BATCH_SIZE));
 assert.equal(batches.flat().length,METRICS_BATCH_SIZE+METRICS_QUEUE_LIMIT);
 assert.equal(batches[1][0].durationMs,60);assert.equal(batches.at(-1).at(-1).durationMs,99);
});

test('changing or closing rooms clears queued events and aborts the previous request',async()=>{
 const requests=[];let release;
 const client=createMetricsClient({delayMs:60000,fetch:async(_url,options)=>{requests.push(options);if(requests.length===1)await new Promise(resolve=>{release=resolve;});return new Response(null,{status:202});}});
 client.configureMetricsSession(seat);
 for(let i=0;i<11;i++)client.trackMetric('card_drag',{card:'ddos',outcome:'cancelled'});
 client.configureMetricsSession({code:'XYZ789',token:'second-seat'});
 assert.equal(requests[0].signal.aborted,true);
 client.trackMetric('card_drag',{card:'shield',outcome:'submitted'});await client.flushMetrics();
 release();await tick();
 client.trackMetric('card_drag',{card:'expand',outcome:'cancelled'});client.configureMetricsSession(null);await client.flushMetrics();
 assert.equal(requests.length,2);
 assert.deepEqual(JSON.parse(requests[1].body),{code:'XYZ789',events:[{type:'card_drag',card:'shield',outcome:'submitted'}]});
 assert.equal(requests[1].headers.Authorization,'Bearer second-seat');
});

test('network and HTTP failures are best effort: no rejection, retries or replayed events',async()=>{
 let calls=0;
 const client=createMetricsClient({delayMs:60000,fetch:async()=>{calls++;if(calls===1)throw new TypeError('private server exception');return new Response(null,{status:503});}});
 client.configureMetricsSession(seat);
 client.trackMetric('card_drag',{card:'ddos',outcome:'submitted'});await assert.doesNotReject(client.flushMetrics());await client.flushMetrics();assert.equal(calls,1);
 client.trackMetric('card_drag',{card:'shield',outcome:'invalid'});await assert.doesNotReject(client.flushMetrics());await client.flushMetrics();assert.equal(calls,2);
 client.configureMetricsSession(null);
});

test('reconfiguring the same seat preserves its pending batch',async()=>{
 const batches=[];
 const client=createMetricsClient({delayMs:60000,fetch:async(_url,options)=>{batches.push(JSON.parse(options.body));return response();}});
 client.configureMetricsSession(seat);client.trackMetric('card_drag',{card:'supply',outcome:'cancelled',durationMs:123.4});
 client.configureMetricsSession({...seat});await client.flushMetrics();client.configureMetricsSession(null);
 assert.equal(batches.length,1);assert.equal(batches[0].events[0].durationMs,123);
});
