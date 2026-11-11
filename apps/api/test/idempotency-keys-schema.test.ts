import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { idempotencyKeys } from "../src/db/schema/idempotency_keys.js";
import { getColumn, getPrimaryKeyColumns } from "./information-schema.js";
import { startTestDatabase, type TestDatabase } from "./testcontainers.js";

type IdempotencyKeyInsert = typeof idempotencyKeys.$inferInsert;

function buildIdempotencyKeyRow(
  overrides: Partial<IdempotencyKeyInsert> = {},
): IdempotencyKeyInsert {
  return {
    scope: "heroes",
    key: randomUUID(),
    request_hash: "a".repeat(64),
    response_status: 201,
    response_body: JSON.stringify({ id: randomUUID(), name: "Teste" }),
    created_at: new Date("2024-05-01T10:00:00.000Z"),
    ...overrides,
  };
}

describe("schema de idempotency_keys (MySQL real via Testcontainers)", () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await startTestDatabase();
  }, 120_000);

  afterAll(async () => {
    await testDatabase.stop();
  }, 60_000);

  it("existe e aceita inserir uma linha válida", async () => {
    const row = buildIdempotencyKeyRow();
    await expect(
      testDatabase.db.insert(idempotencyKeys).values(row),
    ).resolves.toBeDefined();
  });

  it("tem a PK composta por (scope, key)", async () => {
    const pkColumns = await getPrimaryKeyColumns(
      testDatabase.db,
      "idempotency_keys",
    );
    expect(pkColumns).toEqual(["scope", "key"]);
  });

  it("insere e lê de volta os mesmos valores", async () => {
    const row = buildIdempotencyKeyRow({
      scope: "missions",
      key: randomUUID(),
      request_hash: "b".repeat(64),
      response_status: 200,
      response_body: JSON.stringify({ ok: true }),
    });
    await testDatabase.db.insert(idempotencyKeys).values(row);

    const found = await testDatabase.db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, row.key));
    expect(found).toHaveLength(1);
    const read = found[0]!;

    expect(read.scope).toBe(row.scope);
    expect(read.key).toBe(row.key);
    expect(read.request_hash).toBe(row.request_hash);
    expect(read.response_status).toBe(row.response_status);
    expect(read.response_body).toBe(row.response_body);
    expect(
      new Date(read.created_at as string | number | Date).toISOString(),
    ).toBe(row.created_at.toISOString());
  });

  it("define idempotency_keys.created_at como DATETIME(3)", async () => {
    const info = await getColumn(
      testDatabase.db,
      "idempotency_keys",
      "created_at",
    );
    expect(info.COLUMN_TYPE).toBe("datetime(3)");
  });

  it("rejeita inserir outra linha com o mesmo (scope, key)", async () => {
    const row = buildIdempotencyKeyRow({ scope: "heroes", key: "abc" });
    await testDatabase.db.insert(idempotencyKeys).values(row);

    const duplicate = buildIdempotencyKeyRow({ scope: "heroes", key: "abc" });
    await expect(
      testDatabase.db.insert(idempotencyKeys).values(duplicate),
    ).rejects.toBeTruthy();
  });
});
