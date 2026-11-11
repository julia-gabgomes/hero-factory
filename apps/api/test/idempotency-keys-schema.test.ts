import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { idempotencyKeys } from "../src/db/schema/idempotency_keys.js";
import { getColumn, getPrimaryKeyColumns } from "./information-schema.js";
import { startTestDatabase, type TestDatabase } from "./testcontainers.js";

// Contrato assumido para esta etapa (ainda não implementado):
// - `apps/api/src/db/schema/idempotency_keys.ts` exporta a tabela Drizzle
//   `idempotencyKeys`, mapeada para a tabela `idempotency_keys`, com as
//   colunas `scope, key, request_hash, response_status, response_body,
//   created_at`, PK composta `(scope, key)` e `created_at` DATETIME(3).
//
// Os cenários C2 e C4 pedem a definição do SQL gerado pela migration. Em vez
// de parsear o arquivo .sql, este teste consulta o `information_schema` do
// próprio MySQL real do Testcontainers (já com as migrations aplicadas) —
// mesmo padrão de `hero-changes-schema.test.ts` e `mission-heroes-schema.test.ts`.

type IdempotencyKeyInsert = typeof idempotencyKeys.$inferInsert;

function buildIdempotencyKeyRow(overrides: Partial<IdempotencyKeyInsert> = {}): IdempotencyKeyInsert {
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

  // Etapa 05 · C1.a — Dado o banco limpo (via Testcontainers), quando se
  // aplica a migration de `idempotency_keys` em sequência às demais, então a
  // tabela passa a existir sem erro: uma linha válida pode ser inserida pelo
  // cliente Drizzle.
  it("existe e aceita inserir uma linha válida", async () => {
    const row = buildIdempotencyKeyRow();
    await expect(testDatabase.db.insert(idempotencyKeys).values(row)).resolves.toBeDefined();
  });

  // Etapa 05 · C2.a — Dado o arquivo de migration SQL gerado (verificado via
  // information_schema do banco já migrado), quando se lê a PK da tabela
  // `idempotency_keys`, então ela é composta exatamente por `(scope, key)`,
  // nessa ordem.
  it("tem a PK composta por (scope, key)", async () => {
    const pkColumns = await getPrimaryKeyColumns(testDatabase.db, "idempotency_keys");
    expect(pkColumns).toEqual(["scope", "key"]);
  });

  // Etapa 05 · C3.a — Dado o banco com a migration aplicada, quando se
  // insere uma linha com `scope`, `key`, `request_hash`, `response_status`,
  // `response_body` e `created_at` preenchidos, então a inserção é aceita e
  // a leitura devolve os mesmos valores em cada uma dessas colunas.
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
    expect(new Date(read.created_at as string | number | Date).toISOString()).toBe(
      row.created_at.toISOString(),
    );
  });

  // Etapa 05 · C4.a — Dado o arquivo de migration SQL gerado (verificado via
  // information_schema), quando se lê a definição de `created_at`, então
  // ela é DATETIME(3).
  it("define idempotency_keys.created_at como DATETIME(3)", async () => {
    const info = await getColumn(testDatabase.db, "idempotency_keys", "created_at");
    expect(info.COLUMN_TYPE).toBe("datetime(3)");
  });

  // Etapa 05 · C5.a — Dado uma linha já existente com `scope = "heroes"` e
  // `key = "abc"`, quando se tenta inserir outra linha com o mesmo `scope` e
  // `key`, então o banco rejeita por chave duplicada (PK composta).
  it("rejeita inserir outra linha com o mesmo (scope, key)", async () => {
    const row = buildIdempotencyKeyRow({ scope: "heroes", key: "abc" });
    await testDatabase.db.insert(idempotencyKeys).values(row);

    const duplicate = buildIdempotencyKeyRow({ scope: "heroes", key: "abc" });
    await expect(testDatabase.db.insert(idempotencyKeys).values(duplicate)).rejects.toBeTruthy();
  });
});
