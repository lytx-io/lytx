CREATE TABLE `daily_site_metrics` (
	`utc_day` text PRIMARY KEY NOT NULL,
	`total_events` integer DEFAULT 0 NOT NULL,
	`page_views` integer DEFAULT 0 NOT NULL,
	`conversion_events` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_metric_facts` (
	`utc_day` text NOT NULL,
	`metric_family` text NOT NULL,
	`metric_key` text NOT NULL,
	`metric_value` integer DEFAULT 0 NOT NULL,
	`dimension_json` text,
	`first_seen_at` integer,
	`last_seen_at` integer,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`utc_day`, `metric_family`, `metric_key`)
);
--> statement-breakpoint
CREATE INDEX `daily_metric_facts_family_day_idx` ON `daily_metric_facts` (`metric_family`,`utc_day`);--> statement-breakpoint
CREATE INDEX `daily_metric_facts_family_day_value_idx` ON `daily_metric_facts` (`metric_family`,`utc_day`,`metric_value`);
