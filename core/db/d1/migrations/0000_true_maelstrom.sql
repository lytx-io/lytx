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
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `api_key` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text,
	`team_id` integer NOT NULL,
	`enabled` integer DEFAULT true,
	`permissions` text DEFAULT '{"read":true,"write":true}' NOT NULL,
	`allowed_team_members` text DEFAULT '[]',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `api_key_team_id_idx` ON `api_key` (`team_id`);--> statement-breakpoint
CREATE TABLE `invited_user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`accepted` integer NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invited_user_email_unique` ON `invited_user` (`email`);--> statement-breakpoint
CREATE INDEX `invited_user_team_id_idx` ON `invited_user` (`team_id`);--> statement-breakpoint
CREATE INDEX `invited_user_email_idx` ON `invited_user` (`email`);--> statement-breakpoint
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
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_token_idx` ON `session` (`token`);--> statement-breakpoint
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
CREATE INDEX `site_events_referer_idx` ON `site_events` (`referer`);--> statement-breakpoint
CREATE TABLE `sites` (
	`site_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`tag_id` text NOT NULL,
	`track_web_events` integer DEFAULT false NOT NULL,
	`gdpr` integer DEFAULT false,
	`event_load_strategy` text DEFAULT 'sdk' NOT NULL,
	`external_id` integer DEFAULT 0 NOT NULL,
	`site_db_adapter` text DEFAULT 'sqlite' NOT NULL,
	`team_id` integer NOT NULL,
	`name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`domain` text,
	`tag_manager` integer DEFAULT false,
	`autocapture` integer DEFAULT true,
	`rid_salt` text,
	`rid_salt_expire` integer,
	`tag_id_override` text
);
--> statement-breakpoint
CREATE INDEX `sites_team_id_idx` ON `sites` (`team_id`);--> statement-breakpoint
CREATE INDEX `sites_tag_id_idx` ON `sites` (`tag_id`);--> statement-breakpoint
CREATE INDEX `sites_domain_idx` ON `sites` (`domain`);--> statement-breakpoint
CREATE TABLE `team` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	`updated_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`name` text,
	`uuid` text,
	`db_adapter` text DEFAULT 'sqlite' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_member` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`user_id` text NOT NULL,
	`allowed_site_ids` text DEFAULT '["all"]',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `team_member_team_id_idx` ON `team_member` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_member_user_id_idx` ON `team_member` (`user_id`);--> statement-breakpoint
CREATE INDEX `team_member_team_user_idx` ON `team_member` (`team_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`timezone` text,
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
