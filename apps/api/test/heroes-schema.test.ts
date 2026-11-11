import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { heroes } from "../src/db/schema/heroes.js";
import { buildHeroRow } from "./factories.js";
import { getColumn, getIndexes } from "./information-schema.js";
import { startTestDatabase, type TestDatabase } from "./testcontainers.js";

describe("schema de heroes (MySQL real via Testcontainers)", () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await startTestDatabase();
  }, 120_000);

  afterAll(async () => {
    await testDatabase.stop();
  }, 60_000);

  it("insere e lê de volta os mesmos valores em heroes", async () => {
    const row = buildHeroRow();

    await testDatabase.db.insert(heroes).values(row);

    const found = await testDatabase.db
      .select()
      .from(heroes)
      .where(eq(heroes.id, row.id));
    expect(found).toHaveLength(1);
    const read = found[0]!;

    expect(read.id).toBe(row.id);
    expect(read.name).toBe(row.name);
    expect(read.nickname).toBe(row.nickname);
    expect(read.universe).toBe(row.universe);
    expect(read.main_power).toBe(row.main_power);
    expect(read.date_of_birth).toBe("1990-06-18");
    expect(read.avatar_url).toBeNull();
    expect(read.is_active).toBe(true);
    expect(read.deleted_at).toBeNull();
    expect(
      new Date(read.created_at as string | number | Date).toISOString(),
    ).toBe(row.created_at.toISOString());
    expect(
      new Date(read.updated_at as string | number | Date).toISOString(),
    ).toBe(row.updated_at.toISOString());
  });

  it("rejeita duas linhas com o mesmo name, nickname e date_of_birth", async () => {
    const shared = {
      name: `Duplicado ${randomUUID()}`,
      nickname: `Nick duplicado ${randomUUID()}`,
      date_of_birth: "1985-03-10",
    };
    const first = buildHeroRow(shared);
    const second = buildHeroRow(shared);

    await testDatabase.db.insert(heroes).values(first);

    await expect(
      testDatabase.db.insert(heroes).values(second),
    ).rejects.toMatchObject({
      cause: { code: "ER_DUP_ENTRY" },
    });
  });

  it("rejeita a mesma combinação única mesmo quando a nova linha tem deleted_at preenchido", async () => {
    const shared = {
      name: `Excluído ${randomUUID()}`,
      nickname: `Nick excluído ${randomUUID()}`,
      date_of_birth: "1978-12-25",
    };
    const active = buildHeroRow(shared);
    const deleted = buildHeroRow({
      ...shared,
      deleted_at: new Date("2024-01-01T00:00:00.000Z"),
    });

    await testDatabase.db.insert(heroes).values(active);

    await expect(
      testDatabase.db.insert(heroes).values(deleted),
    ).rejects.toMatchObject({
      cause: { code: "ER_DUP_ENTRY" },
    });
  });

  it("define heroes.id como CHAR(36) CHARACTER SET ascii COLLATE ascii_bin", async () => {
    const column = await getColumn(testDatabase.db, "heroes", "id");
    expect(column.COLUMN_TYPE).toBe("char(36)");
    expect(column.CHARACTER_SET_NAME).toBe("ascii");
    expect(column.COLLATION_NAME).toBe("ascii_bin");
  });

  it.each([
    { column: "name", length: 120 },
    { column: "nickname", length: 60 },
    { column: "universe", length: 60 },
    { column: "main_power", length: 80 },
    { column: "avatar_url", length: 2048 },
  ])(
    "define heroes.$column como VARCHAR($length) com collation utf8mb4_0900_ai_ci",
    async ({ column, length }) => {
      const info = await getColumn(testDatabase.db, "heroes", column);
      expect(info.COLUMN_TYPE).toBe(`varchar(${length})`);
      expect(info.COLLATION_NAME).toBe("utf8mb4_0900_ai_ci");
    },
  );

  it("deixa heroes.avatar_url opcional", async () => {
    const info = await getColumn(testDatabase.db, "heroes", "avatar_url");
    expect(info.IS_NULLABLE).toBe("YES");
  });

  it("define heroes.date_of_birth como DATE", async () => {
    const info = await getColumn(testDatabase.db, "heroes", "date_of_birth");
    expect(info.COLUMN_TYPE).toBe("date");
  });

  it.each(["created_at", "updated_at"])(
    "define heroes.%s como DATETIME(3)",
    async (column) => {
      const info = await getColumn(testDatabase.db, "heroes", column);
      expect(info.COLUMN_TYPE).toBe("datetime(3)");
    },
  );

  it("define heroes.version como INT NOT NULL DEFAULT 1", async () => {
    const info = await getColumn(testDatabase.db, "heroes", "version");
    expect(info.COLUMN_TYPE).toBe("int");
    expect(info.IS_NULLABLE).toBe("NO");
    expect(info.COLUMN_DEFAULT).toBe("1");
  });

  it("tem um índice cobrindo (deleted_at, created_at, id, name, nickname) nessa ordem", async () => {
    const indexes = await getIndexes(testDatabase.db, "heroes");
    const expectedOrder = [
      "deleted_at",
      "created_at",
      "id",
      "name",
      "nickname",
    ];

    const matching = [...indexes.values()].find(
      (index) =>
        index.columns.length === expectedOrder.length &&
        index.columns.every((col, i) => col === expectedOrder[i]),
    );

    expect(matching).toBeDefined();
  });
});
