CREATE TABLE `custom_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`team_id` integer NOT NULL,
	`site_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`config` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_reports_uuid_unique` ON `custom_reports` (`uuid`);--> statement-breakpoint
CREATE INDEX `custom_reports_team_id_idx` ON `custom_reports` (`team_id`);--> statement-breakpoint
CREATE INDEX `custom_reports_site_id_idx` ON `custom_reports` (`site_id`);--> statement-breakpoint
CREATE INDEX `custom_reports_team_site_idx` ON `custom_reports` (`team_id`,`site_id`);
