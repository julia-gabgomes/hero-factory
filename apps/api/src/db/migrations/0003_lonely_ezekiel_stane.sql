CREATE TABLE `hero_changes` (
	`id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`hero_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`event` enum('created','updated','activated','inactivated','deleted') NOT NULL,
	`field` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
	`old_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
	`new_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `hero_changes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `hero_changes` ADD CONSTRAINT `hero_changes_hero_id_heroes_id_fk` FOREIGN KEY (`hero_id`) REFERENCES `heroes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `hero_changes_hero_id_created_at_id_idx` ON `hero_changes` (`hero_id`,`created_at`,`id`);