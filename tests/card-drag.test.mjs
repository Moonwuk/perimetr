import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const filename=new URL('../components/game/use-card-drag.ts',import.meta.url);
const compiled=ts.transpileModule(readFileSync(filename,'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
 fileName:filename.pathname,
}).outputText;

// Exercise the hook's native event contract without depending on a browser binary.
// Browser-owned scrolling, pointer capture, and layout still require device QA.
function harness(initial={},handStyle={overflowX:'auto',overflowY:'hidden'}){
 const window=new EventTarget(),document=new EventTarget();document.visibilityState='visible';
 const scroller={style:handStyle};window.getComputedStyle=element=>element.style;
 const slots=[],timers=new Map(),events=[];let cursor=0,clock=0,nextTimer=0,handlers,options;
 const changed=(before,after)=>!before||before.length!==after.length||before.some((item,i)=>!Object.is(item,after[i]));
 const react={
  useRef(value){const i=cursor++;return slots[i]??(slots[i]={current:value});},
  useCallback(callback,deps){const i=cursor++,slot=slots[i];if(!slot||changed(slot.deps,deps))slots[i]={deps,value:callback};return slots[i].value;},
  useLayoutEffect(effect,deps){const i=cursor++,slot=slots[i];if(!slot||changed(slot.deps,deps))slots[i]={deps,effect,cleanup:slot?.cleanup,pending:true};},
 };
 const compiledModule={exports:{}};
 new vm.Script(compiled,{filename:filename.pathname}).runInNewContext({
  module:compiledModule,exports:compiledModule.exports,require:name=>name==='react'?react:require(name),window,document,
  setTimeout:(callback,delay)=>{const id=++nextTimer;timers.set(id,{callback,at:clock+delay});return id;},
  clearTimeout:id=>timers.delete(id),
 });
 const callbacks={
  onStart:(card,point)=>events.push(['start',card,point]),
  onMove:point=>events.push(['move',point]),
  onDrop:point=>events.push(['drop',point]),
  onCancel:()=>events.push(['cancel']),
 };
 options={enabled:true,resetKey:'turn-1',selected:null,...callbacks,...initial};
 const render=(next={})=>{
  options={...options,...next};cursor=0;handlers=compiledModule.exports.useCardDrag(options);
  for(const slot of slots){if(!slot.pending)continue;slot.pending=false;slot.cleanup?.();slot.cleanup=slot.effect();}
 };
 render();
 const source={closest:selector=>selector==='.compact-hand'?scroller:null,captures:new Set(),setPointerCapture(id){this.captures.add(id);},hasPointerCapture(id){return this.captures.has(id);},releasePointerCapture(id){this.captures.delete(id);dispatch('lostpointercapture',{pointerId:id});}};
 const dispatch=(type,fields={},cancelable=true)=>{const event=new Event(type,{cancelable});Object.assign(event,fields);window.dispatchEvent(event);return event;};
 const touch=(x,y,id=1)=>({clientX:x,clientY:y,identifier:id});
 const beginTouch=(x=100,y=300)=>{const point=touch(x,y);dispatch('touchstart',{touches:[point],changedTouches:[point]});handlers.startTouch('ddos',{touches:[point],currentTarget:source});};
 const beginPointer=(pointerType='mouse',x=100,y=300,id=1)=>{dispatch('pointerdown',{pointerId:id,pointerType});handlers.startPointer('ddos',{pointerId:id,pointerType,isPrimary:true,button:0,clientX:x,clientY:y,currentTarget:source});};
 return {
  events,source,render,dispatch,touch,beginTouch,beginPointer,get handlers(){return handlers;},
  advance(ms){clock+=ms;for(const [id,timer]of timers){if(timer.at<=clock){timers.delete(id);timer.callback();}}},
  dispose(){for(const slot of slots)slot.cleanup?.();timers.clear();},
 };
}
const count=(h,type)=>h.events.filter(event=>event[0]===type).length;

test('an unselected card lifts on its first vertical finger movement before any hold',()=>{
 const h=harness();try{
  h.beginTouch();assert.equal(count(h,'start'),0);
  const move=h.dispatch('touchmove',{touches:[h.touch(103,280)]});
  assert.equal(move.defaultPrevented,true);assert.equal(count(h,'start'),1);assert.equal(count(h,'move'),1);
  assert.equal(h.events[0][1],'ddos');assert.deepEqual({...h.events[0][2]},{x:103,y:280});
  h.render({selected:'ddos'});assert.equal(count(h,'cancel'),0);
  h.dispatch('touchend',{touches:[],changedTouches:[h.touch(110,150)]});
  assert.equal(count(h,'drop'),1);h.advance(500);assert.equal(count(h,'start'),1);
 }finally{h.dispose();}
});

test('a horizontal finger swipe belongs to the hand scroller and never plays a card',()=>{
 const h=harness();try{
  h.beginTouch();const move=h.dispatch('touchmove',{touches:[h.touch(140,302)]});
  assert.equal(move.defaultPrevented,false);h.advance(500);
  h.dispatch('touchend',{touches:[],changedTouches:[h.touch(140,302)]});
  assert.equal(count(h,'start'),0);assert.equal(count(h,'drop'),0);
 }finally{h.dispose();}
});

test('a desktop hand that scrolls vertically lifts an unselected card on the first horizontal movement',()=>{
 for(const handStyle of [{overflowY:'auto',overflowX:'hidden'},{overflowY:'scroll',overflowX:'clip'}]){
  const h=harness({},handStyle);try{
   h.beginTouch();const move=h.dispatch('touchmove',{touches:[h.touch(80,303)]});
   assert.equal(move.defaultPrevented,true);assert.equal(count(h,'start'),1);assert.equal(count(h,'move'),1);
   h.render({selected:'ddos'});h.dispatch('touchend',{touches:[],changedTouches:[h.touch(20,303)]});
   assert.equal(count(h,'drop'),1);h.advance(500);assert.equal(count(h,'start'),1);
  }finally{h.dispose();}
 }
});

test('a desktop vertical hand swipe remains available for native scrolling without lifting a card',()=>{
 const h=harness({},{overflowY:'auto',overflowX:'hidden'});try{
  h.beginTouch();const move=h.dispatch('touchmove',{touches:[h.touch(103,260)]});
  assert.equal(move.defaultPrevented,false);h.advance(500);
  h.dispatch('touchend',{touches:[],changedTouches:[h.touch(103,260)]});
  assert.equal(count(h,'start'),0);assert.equal(count(h,'drop'),0);
 }finally{h.dispose();}
});

test('mouse and pen can drag an unselected card immediately and release only once',()=>{
 for(const pointerType of ['mouse','pen']){
  const h=harness();try{
   h.beginPointer(pointerType);h.dispatch('pointermove',{pointerId:1,buttons:1,clientX:100,clientY:280});
   assert.equal(count(h,'start'),1);assert.equal(h.source.captures.has(1),true);
   h.render({selected:'ddos'});h.dispatch('pointerup',{pointerId:1,clientX:100,clientY:150});
   h.dispatch('pointerup',{pointerId:1,clientX:100,clientY:150});
   assert.equal(count(h,'drop'),1);assert.equal(count(h,'cancel'),0);assert.equal(h.source.captures.size,0);
  }finally{h.dispose();}
 }
});

test('a queued compatibility click after a drag is consumed while keyboard clicks pass',()=>{
 const h=harness();try{
  h.beginTouch();h.dispatch('touchmove',{touches:[h.touch(100,280)]});
  h.render({selected:'ddos'});h.dispatch('touchend',{touches:[],changedTouches:[h.touch(100,150)]});
  h.render({enabled:false,selected:null});
  const keyboard=h.dispatch('click',{detail:0});assert.equal(keyboard.defaultPrevented,false);
  const compatibility=h.dispatch('click',{detail:1});assert.equal(compatibility.defaultPrevented,true);
  const later=h.dispatch('click',{detail:1});assert.equal(later.defaultPrevented,false);
  assert.equal(count(h,'drop'),1);
 }finally{h.dispose();}
});

test('Escape, touch cancellation, and a second finger cancel an active drag without a drop',()=>{
 for(const cancel of [h=>h.dispatch('keydown',{key:'Escape'}),h=>h.dispatch('touchcancel'),h=>h.dispatch('touchstart',{touches:[h.touch(100,280),h.touch(110,280,2)]})]){
  const h=harness();try{
   h.beginTouch();h.dispatch('touchmove',{touches:[h.touch(100,280)]});h.render({selected:'ddos'});
   cancel(h);h.dispatch('touchend',{touches:[],changedTouches:[h.touch(100,150)]});
   assert.equal(count(h,'cancel'),1);assert.equal(count(h,'drop'),0);
  }finally{h.dispose();}
 }
});

test('selection clearing, turn changes, and disabling play cancel active gestures',()=>{
 for(const update of [{selected:null},{resetKey:'turn-2'},{enabled:false}]){
  const h=harness();try{
   h.beginTouch();h.dispatch('touchmove',{touches:[h.touch(100,280)]});h.render({selected:'ddos'});
   h.render(update);h.dispatch('touchend',{touches:[],changedTouches:[h.touch(100,150)]});
   assert.equal(count(h,'cancel'),1);assert.equal(count(h,'drop'),0);
  }finally{h.dispose();}
 }
});

test('browser-owned uncancellable touch movement cancels rather than playing a card',()=>{
 const h=harness();try{
  h.beginTouch();h.dispatch('touchmove',{touches:[h.touch(100,280)]},false);
  h.dispatch('touchend',{touches:[],changedTouches:[h.touch(100,150)]});
  assert.equal(count(h,'cancel'),1);assert.equal(count(h,'drop'),0);assert.equal(count(h,'move'),0);
 }finally{h.dispose();}
});

test('a pending hold is cancelled by a turn change and disabled play cannot arm one',()=>{
 const h=harness();try{
  h.beginTouch();h.render({resetKey:'turn-2'});h.advance(500);
  assert.equal(count(h,'start'),0);
  h.render({enabled:false});h.beginTouch();h.advance(500);assert.equal(count(h,'start'),0);
 }finally{h.dispose();}
});
