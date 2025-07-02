CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
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
CREATE TABLE `sites` (
	`site_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tag_id` text NOT NULL,
	`track_web_events` integer DEFAULT false NOT NULL,
	`team_id` integer,
	`client` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`domain` text,
	`gdpr` integer,
	`rid_salt` text,
	`rid_salt_expire` integer,
	`tag_id_override` text
);
--> statement-breakpoint
CREATE TABLE `team` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer,
	`updated_at` integer NOT NULL,
	`created_by` text,
	`name` text,
	`uuid` text
);
--> statement-breakpoint
CREATE TABLE `team_member` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer NOT NULL
);
