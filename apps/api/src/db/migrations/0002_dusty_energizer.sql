CREATE TABLE `mission_heroes` (
	`mission_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`hero_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	CONSTRAINT `mission_heroes_mission_id_hero_id_pk` PRIMARY KEY(`mission_id`,`hero_id`)
);
--> statement-breakpoint
ALTER TABLE `mission_heroes` ADD CONSTRAINT `mission_heroes_mission_id_missions_id_fk` FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mission_heroes` ADD CONSTRAINT `mission_heroes_hero_id_heroes_id_fk` FOREIGN KEY (`hero_id`) REFERENCES `heroes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `mission_heroes_hero_id_idx` ON `mission_heroes` (`hero_id`);