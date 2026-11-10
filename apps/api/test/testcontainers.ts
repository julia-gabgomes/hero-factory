import { fileURLToPath } from "node:url";
import {
  MySqlContainer,
  type StartedMySqlContainer,
} from "@testcontainers/mysql";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { createDbClient, type DbClient } from "../src/db/client.js";

const MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../src/db/migrations", import.meta.url),
);

export interface TestDatabase {
  db: DbClient["db"];
  stop: () => Promise<void>;
}

export async function startTestDatabase(): Promise<TestDatabase> {
  const container: StartedMySqlContainer = await new MySqlContainer("mysql:8.4")
    .withDatabase("hero_factory_test")
    .withUsername("hero_factory")
    .withUserPassword("hero_factory")
    .start();

  const { db, pool } = createDbClient(container.getConnectionUri());

  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  const stop = async (): Promise<void> => {
    await pool.end();
    await container.stop();
  };

  return { db, stop };
}
