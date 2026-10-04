CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`host_hash` text NOT NULL,
	`guest_hash` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rooms_expires_at` ON `rooms` (`expires_at`);