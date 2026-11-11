import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { heroes } from "../src/db/schema/heroes.js";
import { idempotencyKeys } from "../src/db/schema/idempotency_keys.js";
import { buildHeroRow } from "./factories.js";
import { startTestDatabase, type TestDatabase } from "./testcontainers.js";
import {
  IdempotencyKeyMismatchError,
  withIdempotency,
} from "../src/http/idempotency.js";

describe("withIdempotency (MySQL real via Testcontainers)", () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await startTestDatabase();
  }, 120_000);

  afterAll(async () => {
    await testDatabase.stop();
  }, 60_000);

  it("executa fn uma vez só em duas chamadas concorrentes com a mesma chave", async () => {
    const scope = "test-concurrent";
    const key = randomUUID();
    const requestHash = `hash-${randomUUID()}`;

    let callCount = 0;
    const sharedBody = { createdId: randomUUID() };
    const fn = () => {
      callCount += 1;
      return Promise.resolve({ status: 201, body: sharedBody });
    };

    const [first, second] = await Promise.all([
      withIdempotency(testDatabase.db, { scope, key, requestHash }, fn),
      withIdempotency(testDatabase.db, { scope, key, requestHash }, fn),
    ]);

    expect(callCount).toBe(1);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body).toEqual(sharedBody);
    expect(second.body).toEqual(sharedBody);

    const replayedFlags = [first.replayed, second.replayed].sort();
    expect(replayedFlags).toEqual([false, true]);
  });

  it("lança IDEMPOTENCY_KEY_MISMATCH quando a mesma chave é usada com outro requestHash", async () => {
    const scope = "test-mismatch";
    const key = randomUUID();

    await withIdempotency(
      testDatabase.db,
      { scope, key, requestHash: "abc" },
      () => Promise.resolve({ status: 200, body: { ok: true } }),
    );

    let caughtError: unknown;
    try {
      await withIdempotency(
        testDatabase.db,
        { scope, key, requestHash: "xyz" },
        () => Promise.resolve({ status: 200, body: { ok: true } }),
      );
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(IdempotencyKeyMismatchError);
    expect((caughtError as { code?: unknown }).code).toBe(
      "IDEMPOTENCY_KEY_MISMATCH",
    );
  });

  it("executa fn normalmente numa chave nunca usada e devolve replayed: false", async () => {
    const scope = "test-fresh";
    const key = randomUUID();
    const requestHash = `hash-${randomUUID()}`;

    let callCount = 0;
    const result = await withIdempotency(
      testDatabase.db,
      { scope, key, requestHash },
      () => {
        callCount += 1;
        return Promise.resolve({ status: 200, body: { ok: true } });
      },
    );

    expect(callCount).toBe(1);
    expect(result).toEqual({
      status: 200,
      body: { ok: true },
      replayed: false,
    });
  });

  it("desfaz a escrita de fn e não grava a chave quando fn falha", async () => {
    const scope = "test-rollback";
    const key = randomUUID();
    const requestHash = `hash-${randomUUID()}`;
    const heroId = randomUUID();

    const failingFn = async (
      tx: Parameters<Parameters<typeof withIdempotency>[2]>[0],
    ) => {
      await tx.insert(heroes).values(buildHeroRow({ id: heroId }));
      throw new Error("falha proposital de fn");
    };

    await expect(
      withIdempotency(testDatabase.db, { scope, key, requestHash }, failingFn),
    ).rejects.toThrow("falha proposital de fn");

    const persistedHero = await testDatabase.db
      .select()
      .from(heroes)
      .where(eq(heroes.id, heroId));
    expect(persistedHero).toHaveLength(0);

    const persistedKey = await testDatabase.db
      .select()
      .from(idempotencyKeys)
      .where(
        and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)),
      );
    expect(persistedKey).toHaveLength(0);

    let retryCallCount = 0;
    const retryResult = await withIdempotency(
      testDatabase.db,
      { scope, key, requestHash },
      () => {
        retryCallCount += 1;
        return Promise.resolve({ status: 201, body: { retried: true } });
      },
    );

    expect(retryCallCount).toBe(1);
    expect(retryResult).toEqual({
      status: 201,
      body: { retried: true },
      replayed: false,
    });
  });
});
