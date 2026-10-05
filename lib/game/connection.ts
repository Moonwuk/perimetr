export const RECONNECT_GRACE_MS=120_000;
export const OPPONENT_AWAY_MS=30_000;
export type PauseDecision='request'|'accept'|'decline'|'cancel'|'resume';

export type ConnectionInfo={
 active:boolean;
 reconnecting:boolean;
 opponentAway:boolean;
 graceMs:number;
 ownRemainingMs:number;
 opponentRemainingMs:number;
 canClaim:boolean;
};

/** Advance the last server snapshot with elapsed client time, never by failed requests. */
export function roomConnection({presence,serverTime,syncedAt,now,viewer,playing,uncertain,startedAt=0,resumedAt=0,paused=false,graceMs=RECONNECT_GRACE_MS}:{presence:readonly [number,number];serverTime:number;syncedAt:number;now:number;viewer:number;playing:boolean;uncertain:boolean;startedAt?:number;resumedAt?:number;paused?:boolean;graceMs?:number}):ConnectionInfo {
 const elapsed=Math.max(0,now-syncedAt),serverNow=serverTime+elapsed;
 const reconnecting=uncertain||elapsed>16_000;
 const ownAge=Math.max(0,serverNow-Math.max(startedAt,resumedAt,presence[viewer]));
 const otherAge=Math.max(0,serverNow-Math.max(startedAt,resumedAt,presence[1-viewer]));
 const opponentRemainingMs=Math.max(0,graceMs-otherAge);
 return {active:playing&&!paused,reconnecting,opponentAway:otherAge>=OPPONENT_AWAY_MS,graceMs,ownRemainingMs:Math.max(0,graceMs-ownAge),opponentRemainingMs,canClaim:playing&&!paused&&!reconnecting&&opponentRemainingMs===0};
}

export function connectionCountdown(remainingMs:number){
 const seconds=Math.ceil(Math.max(0,remainingMs)/1000);
 return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
}
