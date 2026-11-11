CREATE TABLE `idempotency_keys` (
	`scope` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
	`key` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`request_hash` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`response_status` int NOT NULL,
	`response_body` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `idempotency_keys_scope_key_pk` PRIMARY KEY(`scope`,`key`)
);
