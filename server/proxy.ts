import {isIP} from 'node:net';
function normalized(address: string): string {
 const value = address.trim();
 if (value.startsWith('::ffff:') && isIP(value.slice(7)) === 4) return value.slice(7);
 return value;
}
export function isPrivateProxy(address: string): boolean {
 const ip = normalized(address);
 if (isIP(ip) === 4) {
  const parts = ip.split('.').map(Number);
  return parts[0] === 127 || parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
 }
 return isIP(ip) === 6 && (ip === '::1' || /^f[cd]/i.test(ip));
}
export function clientAddress(remoteAddress: string | undefined, forwardedFor: string | undefined, trustProxy: boolean): string {
 const peer = normalized(remoteAddress || 'unknown');
 if (!trustProxy || !isPrivateProxy(peer) || !forwardedFor) return peer;
 // The nearest private reverse proxy must append or replace X-Forwarded-For.
 // Never trust a client-controlled prefix, Cloudflare header, or public peer.
 const last = normalized(forwardedFor.split(',').at(-1) || '');
 return isIP(last) ? last : peer;
}
