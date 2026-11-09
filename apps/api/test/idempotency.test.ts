import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { heroes } from "../src/db/schema/heroes.js";
import { idempotencyKeys } from "../src/db/schema/idempotency_keys.js";
import { buildHeroRow } from "./factories.js";
import { startTestDatabase, type TestDatabase } from "./testcontainers.js";
import { IdempotencyKeyMismatchError, withIdempotency } from "../src/http/idempotency.js";

// Contrato assumido para esta etapa (ainda não implementado):
// - `apps/api/src/http/idempotency.ts` exporta:
//   - `withIdempotency(db, { scope, key, requestHash }, fn)`, onde `fn` é
//     `(tx) => Promise<{ status: number; body: T }>` e `tx` é a transação
//     Drizzle aberta pelo próprio helper. O retorno é
//     `Promise<{ status: number; body: T; replayed: boolean }>`.
//   - `IdempotencyKeyMismatchError`, uma classe de erro com a propriedade
//     `code === "IDEMPOTENCY_KEY_MISMATCH"`, lançada quando a mesma chave é
//     usada de novo com um `requestHash` diferente.
//   O helper insere a linha em `idempotency_keys` (PK `(scope, key)`) na
//   mesma transação em que roda `fn`, grava `response_status`/
//   `response_body` antes do commit e deixa o rollback desfazer tudo se
//   `fn` falhar.

describe("withIdempotency (MySQL real via Testcontainers)", () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await startTestDatabase();
  }, 120_000);

  afterAll(async () => {
    await testDatabase.stop();
  }, 60_000);

  // Etapa 01 · C1.a — Dado duas chamadas de `withIdempotency` disparadas ao
  // mesmo tempo (via `Promise.all`, sem await entre elas) com o mesmo
  // `scope`, `key` e `requestHash`, quando ambas terminam, então `fn` foi
  // chamado exatamente uma vez, as duas chamadas devolvem o mesmo `status`
  // e o mesmo `body`, e exatamente uma das duas vem marcada com
  // `replayed: true` (a outra com `replayed: false`).
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

  // Etapa 01 · C2.a — Dado uma chave já usada com `requestHash = "abc"`,
  // quando se chama `withIdempotency` de novo com a mesma chave e
  // `requestHash = "xyz"`, então a chamada lança um erro identificável como
  // `IDEMPOTENCY_KEY_MISMATCH` (instância de `IdempotencyKeyMismatchError`
  // com `code === "IDEMPOTENCY_KEY_MISMATCH"`).
  it("lança IDEMPOTENCY_KEY_MISMATCH quando a mesma chave é usada com outro requestHash", async () => {
    const scope = "test-mismatch";
    const key = randomUUID();

    await withIdempotency(testDatabase.db, { scope, key, requestHash: "abc" }, () =>
      Promise.resolve({ status: 200, body: { ok: true } }),
    );

    let caughtError: unknown;
    try {
      await withIdempotency(testDatabase.db, { scope, key, requestHash: "xyz" }, () =>
        Promise.resolve({ status: 200, body: { ok: true } }),
      );
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(IdempotencyKeyMismatchError);
    expect((caughtError as { code?: unknown }).code).toBe("IDEMPOTENCY_KEY_MISMATCH");
  });

  // Etapa 01 · C3.a — Dado uma chave nunca usada, quando se chama
  // `withIdempotency`, então `fn` é executado e o resultado devolvido tem o
  // `status` e o `body` produzidos por `fn`, com `replayed: false`.
  it("executa fn normalmente numa chave nunca usada e devolve replayed: false", async () => {
    const scope = "test-fresh";
    const key = randomUUID();
    const requestHash = `hash-${randomUUID()}`;

    let callCount = 0;
    const result = await withIdempotency(testDatabase.db, { scope, key, requestHash }, () => {
      callCount += 1;
      return Promise.resolve({ status: 200, body: { ok: true } });
    });

    expect(callCount).toBe(1);
    expect(result).toEqual({ status: 200, body: { ok: true }, replayed: false });
  });

  // Etapa 01 · C4.a — Dado uma `fn` que insere uma linha de verdade em
  // `heroes` e depois lança um erro, quando `withIdempotency` é chamado,
  // então: (1) o erro é propagado; (2) a linha inserida por `fn` não
  // persiste (rollback); (3) a chave não fica em `idempotency_keys`; e (4)
  // uma chamada seguinte com a mesma chave executa `fn` de novo
  // normalmente, em vez de ser tratada como réplica ou como conflito.
  it("desfaz a escrita de fn e não grava a chave quando fn falha", async () => {
    const scope = "test-rollback";
    const key = randomUUID();
    const requestHash = `hash-${randomUUID()}`;
    const heroId = randomUUID();

    const failingFn = async (tx: Parameters<Parameters<typeof withIdempotency>[2]>[0]) => {
      await tx.insert(heroes).values(buildHeroRow({ id: heroId }));
      throw new Error("falha proposital de fn");
    };

    await expect(
      withIdempotency(testDatabase.db, { scope, key, requestHash }, failingFn),
    ).rejects.toThrow("falha proposital de fn");

    const persistedHero = await testDatabase.db.select().from(heroes).where(eq(heroes.id, heroId));
    expect(persistedHero).toHaveLength(0);

    const persistedKey = await testDatabase.db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)));
    expect(persistedKey).toHaveLength(0);

    let retryCallCount = 0;
    const retryResult = await withIdempotency(testDatabase.db, { scope, key, requestHash }, () => {
      retryCallCount += 1;
      return Promise.resolve({ status: 201, body: { retried: true } });
    });

    expect(retryCallCount).toBe(1);
    expect(retryResult).toEqual({ status: 201, body: { retried: true }, replayed: false });
  });
});
