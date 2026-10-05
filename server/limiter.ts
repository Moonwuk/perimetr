/** Fixed windows per IP. A full table rejects new keys instead of evicting active limits. */
export class MemoryLimiter {
 private readonly entries = new Map<string, {count: number; expires: number}>();
 private nextSweep = 0;
 private readonly capacity: number;
 private readonly windowMs: number;
 private readonly maxKeys: number;
 private readonly now: () => number;
 constructor(capacity: number, windowMs = 60_000, maxKeys = 10_000, now = Date.now) {
  if (capacity < 1 || windowMs < 1 || maxKeys < 1) throw new Error('Invalid rate limiter configuration');
  this.capacity = capacity; this.windowMs = windowMs; this.maxKeys = maxKeys; this.now = now;
 }
 get size(): number { return this.entries.size; }
 async limit({key}: {key: string}): Promise<{success: boolean}> {
  const now = this.now();
  if (now >= this.nextSweep) {
   for (const [name, entry] of this.entries) if (entry.expires <= now) this.entries.delete(name);
   this.nextSweep = now + Math.min(this.windowMs, 10_000);
  }
  let entry = this.entries.get(key);
  if (!entry || entry.expires <= now) {
   if (!entry && this.entries.size >= this.maxKeys) return {success: false};
   entry = {count: 0, expires: now + this.windowMs};
   this.entries.set(key, entry);
  }
  if (entry.count >= this.capacity) return {success: false};
  entry.count++;
  return {success: true};
 }
}
