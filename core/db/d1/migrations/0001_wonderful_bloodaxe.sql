CREATE TABLE `event_labels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`site_id` integer NOT NULL,
	`event_name` text NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `event_labels_site_id_idx` ON `event_labels` (`site_id`);--> statement-breakpoint
CREATE INDEX `event_labels_site_event_idx` ON `event_labels` (`site_id`,`event_name`);