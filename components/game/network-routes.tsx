'use client';
import {t} from '@/lib/game/translate';

import {useEffect,useId,useRef,useState} from 'react';
import {coordinate} from '@/lib/game/engine';
import {routeDescription,type VisibleRoute} from '@/lib/game/visible-routes';
import './network-routes.css';

/** The SVG shares the battle-grid box, not the row/column labels around it. */
export function NetworkRoutes({routes}:{routes:VisibleRoute[]}){
 const svg=useRef<SVGSVGElement>(null),id=useId().replace(/:/g,'');
 const [size,setSize]=useState({width:0,height:0,gapX:0,gapY:0});
 useEffect(()=>{
  const grid=svg.current?.parentElement;
  if(!grid)return;
  const observer=new ResizeObserver(([entry])=>{
   const style=getComputedStyle(grid);
   setSize({width:entry.contentRect.width,height:entry.contentRect.height,gapX:parseFloat(style.columnGap)||0,gapY:parseFloat(style.rowGap)||0});
  });
  observer.observe(grid);
  return ()=>observer.disconnect();
 },[]);
 const width=(size.width-4*size.gapX)/5,height=(size.height-4*size.gapY)/5;
 const point=(cell:number)=>({x:(cell%5)*(width+size.gapX)+width/2,y:Math.floor(cell/5)*(height+size.gapY)+height/2});
 return <svg ref={svg} className="network-route-lines" viewBox={`0 0 ${size.width||1} ${size.height||1}`} aria-hidden="true" focusable="false">
  <defs>
   <marker id={`${id}-arrow`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 1 1 L 7 4 L 1 7" fill="none" stroke="currentColor" strokeWidth="1.5"/></marker>
  </defs>
  {t(size.width>0&&routes.map(route=>{
   const from=point(route.fromCell),to=point(route.toCell),dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);
   // Leave labels and icons clear; both endpoints are still computed from their true cell centres.
   const inset=Math.min(width,height)*.43;
   const x1=from.x+dx/length*inset,y1=from.y+dy/length*inset,x2=to.x-dx/length*inset,y2=to.y-dy/length*inset;
   return <g key={`${route.from}-${route.to}`} className={`network-route ${route.state}`} data-route-from={coordinate(route.fromCell)} data-route-to={coordinate(route.toCell)} data-route-state={route.state}>
    <line className="route-underlay" x1={x1} y1={y1} x2={x2} y2={y2}/>
    <line className="route-stroke" x1={x1} y1={y1} x2={x2} y2={y2} markerEnd={route.state==='available'?`url(#${id}-arrow)`:undefined}/>
   </g>;
  }))}
 </svg>;
}

export function NetworkRouteLegend({id,hint,routes}:{id:string;hint:string;routes:VisibleRoute[]}){
 return <div id={id} className="network-route-legend">
  <span title={t(hint)}>{t(hint)}</span>
  <span className="network-route-accessible">{t(routes.map(routeDescription).join(' '))}</span>
 </div>;
}
