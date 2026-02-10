CREATE TABLE `site_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer,
	`bot_data` text,
	`browser` text,
	`city` text,
	`client_page_url` text,
	`country` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`custom_data` text,
	`device_type` text,
	`event` text NOT NULL,
	`operating_system` text,
	`page_url` text,
	`postal` text,
	`query_params` text,
	`referer` text,
	`region` text,
	`rid` text,
	`screen_height` integer,
	`screen_width` integer,
	`site_id` integer NOT NULL,
	`tag_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `site_events_team_id_idx` ON `site_events` (`team_id`);--> statement-breakpoint
CREATE INDEX `site_events_site_id_idx` ON `site_events` (`site_id`);--> statement-breakpoint
CREATE INDEX `site_events_tag_id_idx` ON `site_events` (`tag_id`);--> statement-breakpoint
CREATE INDEX `site_events_created_at_idx` ON `site_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `site_events_team_site_idx` ON `site_events` (`team_id`,`site_id`);--> statement-breakpoint
CREATE INDEX `site_events_team_tag_idx` ON `site_events` (`team_id`,`tag_id`);--> statement-breakpoint
CREATE INDEX `site_events_site_created_idx` ON `site_events` (`site_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `site_events_team_created_idx` ON `site_events` (`team_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `site_events_country_idx` ON `site_events` (`country`);--> statement-breakpoint
CREATE INDEX `site_events_device_type_idx` ON `site_events` (`device_type`);--> statement-breakpoint
CREATE INDEX `site_events_event_idx` ON `site_events` (`event`);--> statement-breakpoint
CREATE INDEX `site_events_referer_idx` ON `site_events` (`referer`);