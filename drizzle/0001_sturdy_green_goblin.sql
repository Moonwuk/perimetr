ALTER TABLE `rooms` ADD `host_seen_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `guest_seen_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rooms_host_hash` ON `rooms` (`host_hash`);