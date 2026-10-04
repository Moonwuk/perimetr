import { env } from 'cloudflare:workers';
export function roomDb():D1Database {
 const binding=(env as unknown as {DB?:D1Database}).DB;
 if(!binding)throw new Error('ROOM_STORAGE_UNAVAILABLE');
 return binding;
}
