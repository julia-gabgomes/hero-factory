ALTER TABLE `hero_changes` DROP FOREIGN KEY `hero_changes_hero_id_heroes_id_fk`;
--> statement-breakpoint
ALTER TABLE `hero_changes` ADD CONSTRAINT `hero_changes_hero_id_heroes_id_fk` FOREIGN KEY (`hero_id`) REFERENCES `heroes`(`id`) ON DELETE cascade ON UPDATE no action;