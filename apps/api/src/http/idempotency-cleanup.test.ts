import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { idempotencyKeys } from "../db/schema/idempotency_keys.js";
import { deleteExpiredIdempotencyKeys } from "./idempotency-cleanup.js";
import { startTestDatabase, type TestDatabase } from "../test-support/testcontainers.js";

describe("deleteExpiredIdempotencyKeys (MySQL real via Testcontainers)", () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await startTestDatabase();
  }, 120_000);

  afterAll(async () => {
    await testDatabase.stop();
  }, 60_000);

  afterEach(async () => {
    await testDatabase.db.delete(idempotencyKeys);
  });

  it("remove só as chaves com mais de 24h, mantendo as recentes", async () => {
    const now = new Date("2024-06-01T12:00:00.000Z");
    const oldKey = { scope: "heroes:create", key: randomUUID() };
    const recentKey = { scope: "heroes:create", key: randomUUID() };

    await testDatabase.db.insert(idempotencyKeys).values([
      {
        ...oldKey,
        request_hash: "hash-old",
        response_status: 201,
        response_body: "{}",
        created_at: new Date(now.getTime() - 25 * 60 * 60 * 1000),
      },
      {
        ...recentKey,
        request_hash: "hash-recent",
        response_status: 201,
        response_body: "{}",
        created_at: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      },
    ]);

    const deletedCount = await deleteExpiredIdempotencyKeys(
      testDatabase.db,
      now,
    );
    expect(deletedCount).toBe(1);

    const remaining = await testDatabase.db.select().from(idempotencyKeys);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.key).toBe(recentKey.key);
  });
});
