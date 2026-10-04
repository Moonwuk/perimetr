import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', {
  code: text('code').primaryKey(),
  state: text('state').notNull(),
  hostHash: text('host_hash').notNull(),
  guestHash: text('guest_hash'),
  revision: integer('revision').notNull().default(0),
  expiresAt: integer('expires_at').notNull(),
  hostSeenAt: integer('host_seen_at').notNull().default(0),
  guestSeenAt: integer('guest_seen_at').notNull().default(0),
}, table => [index('idx_rooms_expires_at').on(table.expiresAt),uniqueIndex('idx_rooms_host_hash').on(table.hostHash)]);
