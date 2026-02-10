ALTER TABLE `team_billing` ADD `current_period_start` integer;--> statement-breakpoint
ALTER TABLE `team_billing` ADD `usage_mode` text DEFAULT 'metered' NOT NULL;--> statement-breakpoint
ALTER TABLE `team_billing` ADD `usage_cap` integer;