CREATE TABLE `team_billing` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`stripe_price_id` text,
	`plan_name` text,
	`status` text,
	`current_period_end` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `team_billing_team_id_idx` ON `team_billing` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_billing_customer_idx` ON `team_billing` (`stripe_customer_id`);--> statement-breakpoint
CREATE INDEX `team_billing_subscription_idx` ON `team_billing` (`stripe_subscription_id`);