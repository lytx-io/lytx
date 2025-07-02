PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_team` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer,
	`updated_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`name` text,
	`uuid` text
);
--> statement-breakpoint
INSERT INTO `__new_team`("id", "created_at", "updated_at", "created_by", "name", "uuid") SELECT "id", "created_at", "updated_at", "created_by", "name", "uuid" FROM `team`;--> statement-breakpoint
DROP TABLE `team`;--> statement-breakpoint
ALTER TABLE `__new_team` RENAME TO `team`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `sites` ADD `name` text;--> statement-breakpoint
ALTER TABLE `sites` DROP COLUMN `client`;