ALTER TABLE `rooms` ADD `visibility` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_rooms_guest_hash` ON `rooms` (`guest_hash`);--> statement-breakpoint
CREATE INDEX `idx_rooms_available` ON `rooms` (`visibility`,`guest_hash`,`host_seen_at`);