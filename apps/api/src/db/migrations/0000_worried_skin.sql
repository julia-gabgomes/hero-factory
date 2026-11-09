CREATE TABLE `heroes` (
	`id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
	`nickname` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
	`universe` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
	`main_power` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
	`date_of_birth` date NOT NULL,
	`avatar_url` varchar(2048) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
	`is_active` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime(3),
	`version` int NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `heroes_id` PRIMARY KEY(`id`),
	CONSTRAINT `heroes_name_nickname_date_of_birth_unique` UNIQUE(`name`,`nickname`,`date_of_birth`)
);
--> statement-breakpoint
CREATE INDEX `heroes_deleted_at_created_at_id_name_nickname_idx` ON `heroes` (`deleted_at`,`created_at`,`id`,`name`,`nickname`);