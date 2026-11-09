import { limits, missionStatusSchema } from "@hero-factory/shared";
import { char, datetime, index, mysqlEnum, mysqlTable, varchar } from "drizzle-orm/mysql-core";

const missionStatusValues = missionStatusSchema.options as [string, ...string[]];

export const missions = mysqlTable(
  "missions",
  {
    id: char("id", { length: 36 }).primaryKey(),
    title: varchar("title", { length: limits.mission.title }).notNull(),
    status: mysqlEnum("status", missionStatusValues).notNull(),
    starts_at: datetime("starts_at", { fsp: 3 }).notNull(),
    ends_at: datetime("ends_at", { fsp: 3 }).notNull(),
    created_at: datetime("created_at", { fsp: 3 }).notNull(),
    updated_at: datetime("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    index("missions_status_starts_at_ends_at_idx").on(
      table.status,
      table.starts_at,
      table.ends_at,
    ),
  ],
);
