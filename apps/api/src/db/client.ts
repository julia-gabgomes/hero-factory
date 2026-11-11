import { drizzle } from "drizzle-orm/mysql2";
import type { Pool, PoolConnection } from "mysql2/promise";
import mysql from "mysql2/promise";
import { recordDbTime } from "../http/server-timing.js";

function createDrizzle(pool: Pool) {
  return drizzle(pool, { mode: "default" });
}

export type Database = ReturnType<typeof createDrizzle>;

export interface DbClient {
  db: Database;
  pool: Pool;
}

type Queryable = Pick<Pool | PoolConnection, "query" | "execute">;

// Cronometra toda chamada ao MySQL (direto no pool, ou numa conexão travada
// via `getConnection()` para uma transação) e soma em http/server-timing.ts,
// para o cabeçalho `Server-Timing: db;dur=..., total;dur=...` exigido pelo
// apps/api/CLAUDE.md. Fica aqui, e não em cada repository, porque é a única
// camada que vê toda query real, inclusive dentro de `db.transaction()`.
function instrumentTiming(target: Queryable): void {
  const originalQuery = target.query.bind(target);
  const originalExecute = target.execute.bind(target);

  target.query = (async (...args: Parameters<typeof originalQuery>) => {
    const start = performance.now();
    try {
      return await originalQuery(...args);
    } finally {
      recordDbTime(performance.now() - start);
    }
  }) as typeof target.query;

  target.execute = (async (...args: Parameters<typeof originalExecute>) => {
    const start = performance.now();
    try {
      return await originalExecute(...args);
    } finally {
      recordDbTime(performance.now() - start);
    }
  }) as typeof target.execute;
}

export function createDbClient(databaseUrl: string): DbClient {
  const pool = mysql.createPool({
    uri: databaseUrl,
    dateStrings: true,
    timezone: "Z",
  });

  instrumentTiming(pool);

  const originalGetConnection = pool.getConnection.bind(pool);
  pool.getConnection = async () => {
    const connection = await originalGetConnection();
    instrumentTiming(connection);
    return connection;
  };

  const db = createDrizzle(pool);
  return { db, pool };
}
