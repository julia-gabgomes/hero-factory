import { limits } from "@hero-factory/shared";
import {
  boolean,
  char,
  datetime,
  date,
  index,
  int,
  mysqlTable,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const heroes = mysqlTable(
  "heroes",
  {
    id: char("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: limits.name }).notNull(),
    nickname: varchar("nickname", { length: limits.nickname }).notNull(),
    universe: varchar("universe", { length: limits.universe }).notNull(),
    main_power: varchar("main_power", { length: limits.main_power }).notNull(),
    date_of_birth: date("date_of_birth", { mode: "string" }).notNull(),
    avatar_url: varchar("avatar_url", { length: limits.avatar_url }),
    is_active: boolean("is_active").notNull().default(true),
    deleted_at: datetime("deleted_at", { fsp: 3 }),
    version: int("version").notNull().default(1),
    created_at: datetime("created_at", { fsp: 3 }).notNull(),
    updated_at: datetime("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    uniqueIndex("heroes_name_nickname_date_of_birth_unique").on(
      table.name,
      table.nickname,
      table.date_of_birth,
    ),
    index("heroes_deleted_at_created_at_id_name_nickname_idx").on(
      table.deleted_at,
      table.created_at,
      table.id,
      table.name,
      table.nickname,
    ),
  ],
);
