ALTER TABLE `api_key` ADD `site_id` integer;--> statement-breakpoint
CREATE INDEX `api_key_site_id_idx` ON `api_key` (`site_id`);