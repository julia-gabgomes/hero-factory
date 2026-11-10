import { char, datetime, int, mysqlTable, primaryKey, text, varchar } from "drizzle-orm/mysql-core";

const SCOPE_MAX_LENGTH = 60;
const REQUEST_HASH_LENGTH = 64;

export const idempotencyKeys = mysqlTable(
  "idempotency_keys",
  {
    scope: varchar("scope", { length: SCOPE_MAX_LENGTH }).notNull(),
    key: char("key", { length: 36 }).notNull(),
    request_hash: varchar("request_hash", { length: REQUEST_HASH_LENGTH }).notNull(),
    response_status: int("response_status").notNull(),
    response_body: text("response_body").notNull(),
    created_at: datetime("created_at", { fsp: 3 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.scope, table.key] })],
);
