CREATE TABLE `team_ai_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`user_id` text,
	`site_id` integer,
	`request_id` text,
	`request_type` text NOT NULL,
	`provider` text,
	`model` text,
	`status` text DEFAULT 'success' NOT NULL,
	`error_code` text,
	`error_message` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`total_tokens` integer,
	`tool_calls` integer,
	`message_count` integer,
	`prompt_chars` integer,
	`completion_chars` integer,
	`duration_ms` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `team_ai_usage_team_id_idx` ON `team_ai_usage` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_ai_usage_team_created_idx` ON `team_ai_usage` (`team_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `team_ai_usage_team_type_created_idx` ON `team_ai_usage` (`team_id`,`request_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `team_ai_usage_request_id_idx` ON `team_ai_usage` (`request_id`);--> statement-breakpoint
CREATE INDEX `team_ai_usage_user_created_idx` ON `team_ai_usage` (`user_id`,`created_at`);
