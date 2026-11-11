import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { missions } from "../src/db/schema/missions.js";
import { buildMissionRow } from "./factories.js";
import { getColumn, getIndexes } from "./information-schema.js";
import { startTestDatabase, type TestDatabase } from "./testcontainers.js";

describe("schema de missions (MySQL real via Testcontainers)", () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await startTestDatabase();
  }, 120_000);

  afterAll(async () => {
    await testDatabase.stop();
  }, 60_000);

  it("existe e aceita inserir e ler uma missão válida", async () => {
    const row = buildMissionRow();

    await testDatabase.db.insert(missions).values(row);

    const found = await testDatabase.db
      .select()
      .from(missions)
      .where(sql`id = ${row.id}`);
    expect(found).toHaveLength(1);
    expect(found[0]!.title).toBe(row.title);
    expect(found[0]!.status).toBe("scheduled");
  });

  it("define missions.title como VARCHAR(120) com collation utf8mb4_0900_ai_ci", async () => {
    const column = await getColumn(testDatabase.db, "missions", "title");
    expect(column.COLUMN_TYPE).toBe("varchar(120)");
    expect(column.COLLATION_NAME).toBe("utf8mb4_0900_ai_ci");
  });

  it("rejeita inserir uma missão com status inválido", async () => {
    const row = buildMissionRow();

    await expect(
      testDatabase.db.execute(
        sql`INSERT INTO missions (id, title, status, starts_at, ends_at, created_at, updated_at)
            VALUES (${row.id}, ${row.title}, 'pausada', ${row.starts_at}, ${row.ends_at}, ${row.created_at}, ${row.updated_at})`,
      ),
    ).rejects.toBeTruthy();
  });

  it("aceita inserir uma missão com status scheduled", async () => {
    const row = buildMissionRow({ status: "scheduled" });

    await testDatabase.db.insert(missions).values(row);

    const found = await testDatabase.db
      .select()
      .from(missions)
      .where(sql`id = ${row.id}`);
    expect(found).toHaveLength(1);
    expect(found[0]!.status).toBe("scheduled");
  });

  it.each(["starts_at", "ends_at"])(
    "define missions.%s como DATETIME(3)",
    async (column) => {
      const info = await getColumn(testDatabase.db, "missions", column);
      expect(info.COLUMN_TYPE).toBe("datetime(3)");
    },
  );

  it("tem um índice cobrindo (status, starts_at, ends_at) nessa ordem", async () => {
    const indexes = await getIndexes(testDatabase.db, "missions");
    const expectedOrder = ["status", "starts_at", "ends_at"];

    const matching = [...indexes.values()].find(
      (index) =>
        index.columns.length === expectedOrder.length &&
        index.columns.every((col, i) => col === expectedOrder[i]),
    );

    expect(matching).toBeDefined();
  });
});
