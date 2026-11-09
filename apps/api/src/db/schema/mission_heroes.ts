import { char, index, mysqlTable, primaryKey } from "drizzle-orm/mysql-core";
import { heroes } from "./heroes.js";
import { missions } from "./missions.js";

export const missionHeroes = mysqlTable(
  "mission_heroes",
  {
    mission_id: char("mission_id", { length: 36 })
      .notNull()
      .references(() => missions.id),
    hero_id: char("hero_id", { length: 36 })
      .notNull()
      .references(() => heroes.id),
  },
  (table) => [
    primaryKey({ columns: [table.mission_id, table.hero_id] }),
    index("mission_heroes_hero_id_idx").on(table.hero_id),
  ],
);
