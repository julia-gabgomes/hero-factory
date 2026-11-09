CREATE TABLE `missions` (
	`id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`title` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
	`status` enum('scheduled','in_progress','succeeded','failed','cancelled') NOT NULL,
	`starts_at` datetime(3) NOT NULL,
	`ends_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `missions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `missions_status_starts_at_ends_at_idx` ON `missions` (`status`,`starts_at`,`ends_at`);