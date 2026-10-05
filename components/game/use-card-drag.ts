'use client';

import {useCallback,useLayoutEffect,useRef,type MouseEvent as ReactMouseEvent,type PointerEvent as ReactPointerEvent,type TouchEvent as ReactTouchEvent} from 'react';
import type {CardId} from '@/lib/game/engine';

export type CardDragPoint={x:number;y:number};
type Callbacks={
 onStart:(card:CardId,point:CardDragPoint)=>void;
 onMove:(point:CardDragPoint)=>void;
 onDrop:(point:CardDragPoint)=>void;
 onCancel:()=>void;
};
type Options=Callbacks&{enabled:boolean;resetKey:string|number;selected:CardId|null};
type Gesture={
 card:CardId;kind:'touch'|'pointer';pointerType:string;id:number;
 origin:CardDragPoint;point:CardDragPoint;source:HTMLElement;
 active:boolean;timer:ReturnType<typeof setTimeout>|null;
};
const HOLD_MS=280,MOVE_TOLERANCE=10;
const pointOf=(event:{clientX:number;clientY:number}):CardDragPoint=>({x:event.clientX,y:event.clientY});

/** A quick touch stays a click or native hand scroll. Only a held card owns the gesture. */
export function useCardDrag({enabled,resetKey,selected,onStart,onMove,onDrop,onCancel}:Options){
 const callbacks=useRef<Callbacks>({onStart,onMove,onDrop,onCancel});
 const gesture=useRef<Gesture|null>(null);
 const suppressClick=useRef(false);
 useLayoutEffect(()=>{callbacks.current={onStart,onMove,onDrop,onCancel};},[onStart,onMove,onDrop,onCancel]);

 const finish=useCallback((drop:boolean,point?:CardDragPoint,suppress=false)=>{
  const current=gesture.current;if(!current)return;
  gesture.current=null;
  if(current.timer!==null)clearTimeout(current.timer);
  if(current.active||suppress)suppressClick.current=true;
  if(current.kind==='pointer'&&current.source.hasPointerCapture?.(current.id))current.source.releasePointerCapture(current.id);
  if(current.active){if(drop&&point)callbacks.current.onDrop(point);else callbacks.current.onCancel();}
 },[]);

 // Clearing/replacing selection externally (for example Android Back) also cancels a hold.
 useLayoutEffect(()=>{if(gesture.current?.active&&gesture.current.card!==selected)finish(false,undefined,true);},[selected,finish]);

 const activate=useCallback((current:Gesture)=>{
  if(gesture.current!==current||current.active)return;
  if(current.timer!==null){clearTimeout(current.timer);current.timer=null;}
  current.active=true;
  if(current.kind==='pointer'){
   // Keep mouse/stylus releases observable even outside the original card.
   try{current.source.setPointerCapture(current.id);}catch{/* The pointer may already have ended. */}
  }
  callbacks.current.onStart(current.card,current.point);
 },[]);

 const arm=useCallback((card:CardId,kind:Gesture['kind'],id:number,pointerType:string,point:CardDragPoint,source:HTMLElement)=>{
  if(!enabled)return;
  finish(false,undefined,true);
  suppressClick.current=false;
  const current:Gesture={card,kind,id,pointerType,origin:point,point,source,active:false,timer:null};
  gesture.current=current;
  current.timer=setTimeout(()=>activate(current),HOLD_MS);
 },[enabled,finish,activate]);

 // This guard outlives the gesture: a drop can immediately disable dragging while
 // its compatibility click is still queued. A new press resets it; keyboard clicks pass.
 useLayoutEffect(()=>{
  const clearSuppression=()=>{suppressClick.current=false;};
  const guardClick=(event:MouseEvent)=>{
   if(event.detail===0||!suppressClick.current)return;
   suppressClick.current=false;event.preventDefault();event.stopImmediatePropagation();
  };
  window.addEventListener('pointerdown',clearSuppression,true);
  window.addEventListener('touchstart',clearSuppression,true);
  window.addEventListener('click',guardClick,true);
  return()=>{
   window.removeEventListener('pointerdown',clearSuppression,true);
   window.removeEventListener('touchstart',clearSuppression,true);
   window.removeEventListener('click',guardClick,true);
  };
 },[]);

 useLayoutEffect(()=>{
  if(!enabled)return;
  const move=(point:CardDragPoint,event:Event)=>{
   const current=gesture.current;if(!current)return;
   current.point=point;
   if(!current.active){
    if(Math.hypot(point.x-current.origin.x,point.y-current.origin.y)>MOVE_TOLERANCE){
     // Mouse dragging needs no hold; fingers/styli keep native scrolling until held.
     if(current.kind==='pointer'&&current.pointerType==='mouse')activate(current);
     else{finish(false,undefined,true);return;}
    }else return;
   }
   // An uncancellable touch means the browser already owns scrolling: never play it.
   if(current.kind==='touch'&&!event.cancelable){finish(false,undefined,true);return;}
   if(event.cancelable)event.preventDefault();
   callbacks.current.onMove(point);
  };
  const pointerMove=(event:PointerEvent)=>{
   const current=gesture.current;if(current?.kind!=='pointer'||current.id!==event.pointerId)return;
   if(event.buttons===0){finish(false,undefined,true);return;}
   move(pointOf(event),event);
  };
  const pointerUp=(event:PointerEvent)=>{
   const current=gesture.current;if(current?.kind!=='pointer'||current.id!==event.pointerId)return;
   if(current.active&&event.cancelable)event.preventDefault();
   finish(true,pointOf(event));
  };
  const pointerCancel=(event:PointerEvent)=>{
   if(gesture.current?.kind==='pointer'&&gesture.current.id===event.pointerId)finish(false,undefined,true);
  };
  const pointerStart=(event:PointerEvent)=>{
   const current=gesture.current;
   if(current?.kind==='pointer'&&current.id!==event.pointerId)finish(false,undefined,true);
  };
  const touchStart=(event:TouchEvent)=>{if(event.touches.length>1)finish(false,undefined,true);};
  const touchMove=(event:TouchEvent)=>{
   const current=gesture.current;if(current?.kind!=='touch')return;
   if(event.touches.length!==1){finish(false,undefined,true);return;}
   const touch=Array.from(event.touches).find(item=>item.identifier===current.id);
   if(touch)move(pointOf(touch),event);else finish(false,undefined,true);
  };
  const touchEnd=(event:TouchEvent)=>{
   const current=gesture.current;if(current?.kind!=='touch')return;
   const touch=Array.from(event.changedTouches).find(item=>item.identifier===current.id);
   if(!touch)return;
   if(current.active&&event.cancelable)event.preventDefault();
   finish(true,pointOf(touch));
  };
  const cancel=()=>finish(false,undefined,true);
  const keyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')cancel();};
  const visibility=()=>{if(document.visibilityState==='hidden')cancel();};
  const preventNativeDrag=(event:Event)=>{if(gesture.current&&event.cancelable)event.preventDefault();};
  window.addEventListener('pointerdown',pointerStart,true);
  window.addEventListener('pointermove',pointerMove,true);
  window.addEventListener('pointerup',pointerUp,true);
  window.addEventListener('pointercancel',pointerCancel,true);
  window.addEventListener('lostpointercapture',pointerCancel,true);
  window.addEventListener('touchstart',touchStart,true);
  // React's delegated touch handlers can be passive. Native non-passive movement
  // is essential; changing touch-action after a long press cannot claim a gesture.
  window.addEventListener('touchmove',touchMove,{capture:true,passive:false});
  window.addEventListener('touchend',touchEnd,{capture:true,passive:false});
  window.addEventListener('touchcancel',cancel,true);
  window.addEventListener('blur',cancel);
  window.addEventListener('resize',cancel);
  window.addEventListener('keydown',keyDown,true);
  window.addEventListener('contextmenu',preventNativeDrag,true);
  window.addEventListener('dragstart',preventNativeDrag,true);
  document.addEventListener('visibilitychange',visibility);
  return()=>{
   cancel();
   window.removeEventListener('pointerdown',pointerStart,true);
   window.removeEventListener('pointermove',pointerMove,true);
   window.removeEventListener('pointerup',pointerUp,true);
   window.removeEventListener('pointercancel',pointerCancel,true);
   window.removeEventListener('lostpointercapture',pointerCancel,true);
   window.removeEventListener('touchstart',touchStart,true);
   window.removeEventListener('touchmove',touchMove,true);
   window.removeEventListener('touchend',touchEnd,true);
   window.removeEventListener('touchcancel',cancel,true);
   window.removeEventListener('blur',cancel);
   window.removeEventListener('resize',cancel);
   window.removeEventListener('keydown',keyDown,true);
   window.removeEventListener('contextmenu',preventNativeDrag,true);
   window.removeEventListener('dragstart',preventNativeDrag,true);
   document.removeEventListener('visibilitychange',visibility);
  };
 },[enabled,resetKey,activate,finish]);

 const startPointer=useCallback((card:CardId,event:ReactPointerEvent<HTMLElement>)=>{
  if(event.pointerType==='touch'||!event.isPrimary||event.button!==0)return;
  arm(card,'pointer',event.pointerId,event.pointerType,pointOf(event),event.currentTarget);
 },[arm]);
 const startTouch=useCallback((card:CardId,event:ReactTouchEvent<HTMLElement>)=>{
  if(event.touches.length!==1){finish(false,undefined,true);return;}
  const touch=event.touches[0];
  arm(card,'touch',touch.identifier,'touch',pointOf(touch),event.currentTarget);
 },[arm,finish]);
 const consumeClick=useCallback((event:ReactMouseEvent<HTMLElement>)=>{
  if(event.detail===0||!suppressClick.current)return false;
  suppressClick.current=false;event.preventDefault();event.stopPropagation();return true;
 },[]);
 return {startPointer,startTouch,consumeClick};
}
