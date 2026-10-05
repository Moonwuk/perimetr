import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', {
  code: text('code').primaryKey(),
  state: text('state').notNull(),
  hostHash: text('host_hash').notNull(),
  guestHash: text('guest_hash'),
  visibility: text('visibility', { enum: ['private', 'public'] }).notNull().default('private'),
  revision: integer('revision').notNull().default(0),
  expiresAt: integer('expires_at').notNull(),
  hostSeenAt: integer('host_seen_at').notNull().default(0),
  guestSeenAt: integer('guest_seen_at').notNull().default(0),
}, table => [index('idx_rooms_expires_at').on(table.expiresAt),uniqueIndex('idx_rooms_host_hash').on(table.hostHash),index('idx_rooms_guest_hash').on(table.guestHash),index('idx_rooms_available').on(table.visibility,table.guestHash,table.hostSeenAt)]);

// No names, room codes, authentication secrets, hands, layouts or raw exceptions.
export const metricsMatches=sqliteTable('metrics_matches',{
 id:text('id').primaryKey(),matchNumber:integer('match_number').notNull(),visibility:text('visibility').notNull(),revision:integer('revision').notNull(),status:text('status').notNull(),round:integer('round').notNull(),firstPlayer:integer('first_player').notNull(),winner:integer('winner'),money0:integer('money0').notNull(),money1:integer('money1').notNull(),income0:integer('income0').notNull(),income1:integer('income1').notNull(),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull(),startedAt:integer('started_at'),endedAt:integer('ended_at'),finishReason:text('finish_reason'),
},table=>[index('idx_metrics_matches_updated').on(table.updatedAt)]);
export const metricsEvents=sqliteTable('metrics_events',{
 id:text('id').primaryKey(),matchId:text('match_id').notNull(),at:integer('at').notNull(),source:text('source').notNull(),type:text('type').notNull(),actor:integer('actor'),revision:integer('revision').notNull(),round:integer('round').notNull(),data:text('data').notNull(),
},table=>[index('idx_metrics_events_at').on(table.at),index('idx_metrics_events_match').on(table.matchId,table.at)]);
