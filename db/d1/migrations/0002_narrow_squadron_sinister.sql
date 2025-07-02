PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sites` (
	`site_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tag_id` text NOT NULL,
	`track_web_events` integer DEFAULT false NOT NULL,
	`team_id` integer NOT NULL,
	`name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`domain` text,
	`gdpr` integer,
	`rid_salt` text,
	`rid_salt_expire` integer,
	`tag_id_override` text
);
--> statement-breakpoint
INSERT INTO `__new_sites`("site_id", "tag_id", "track_web_events", "team_id", "name", "created_at", "updated_at", "domain", "gdpr", "rid_salt", "rid_salt_expire", "tag_id_override") SELECT "site_id", "tag_id", "track_web_events", "team_id", "name", "created_at", "updated_at", "domain", "gdpr", "rid_salt", "rid_salt_expire", "tag_id_override" FROM `sites`;--> statement-breakpoint
DROP TABLE `sites`;--> statement-breakpoint
ALTER TABLE `__new_sites` RENAME TO `sites`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `team` ADD `db_adapter` text DEFAULT 'sqlite' NOT NULL;