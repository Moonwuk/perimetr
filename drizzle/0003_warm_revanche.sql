CREATE TABLE `metrics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`at` integer NOT NULL,
	`source` text NOT NULL,
	`type` text NOT NULL,
	`actor` integer,
	`revision` integer NOT NULL,
	`round` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_metrics_events_at` ON `metrics_events` (`at`);--> statement-breakpoint
CREATE INDEX `idx_metrics_events_match` ON `metrics_events` (`match_id`,`at`);--> statement-breakpoint
CREATE TABLE `metrics_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`match_number` integer NOT NULL,
	`visibility` text NOT NULL,
	`revision` integer NOT NULL,
	`status` text NOT NULL,
	`round` integer NOT NULL,
	`first_player` integer NOT NULL,
	`winner` integer,
	`money0` integer NOT NULL,
	`money1` integer NOT NULL,
	`income0` integer NOT NULL,
	`income1` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`finish_reason` text
);
--> statement-breakpoint
CREATE INDEX `idx_metrics_matches_updated` ON `metrics_matches` (`updated_at`);