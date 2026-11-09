import { char, datetime, index, mysqlEnum, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";
import { heroes } from "./heroes.js";

export const heroChangeEventValues = [
  "created",
  "updated",
  "activated",
  "inactivated",
  "deleted",
] as const;

export const heroChanges = mysqlTable(
  "hero_changes",
  {
    id: char("id", { length: 36 }).primaryKey(),
    hero_id: char("hero_id", { length: 36 })
      .notNull()
      .references(() => heroes.id),
    event: mysqlEnum("event", heroChangeEventValues).notNull(),
    field: varchar("field", { length: 60 }),
    old_value: text("old_value"),
    new_value: text("new_value"),
    created_at: datetime("created_at", { fsp: 3 }).notNull(),
  },
  (table) => [index("hero_changes_hero_id_created_at_id_idx").on(table.hero_id, table.created_at, table.id)],
);
