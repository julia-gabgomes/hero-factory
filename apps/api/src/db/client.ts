import { drizzle } from "drizzle-orm/mysql2";
import type { Pool } from "mysql2/promise";
import mysql from "mysql2/promise";

function createDrizzle(pool: Pool) {
  return drizzle(pool, { mode: "default" });
}

export type Database = ReturnType<typeof createDrizzle>;

export interface DbClient {
  db: Database;
  pool: Pool;
}

export function createDbClient(databaseUrl: string): DbClient {
  const pool = mysql.createPool({
    uri: databaseUrl,
    dateStrings: true,
    timezone: "Z",
  });
  const db = createDrizzle(pool);
  return { db, pool };
}
