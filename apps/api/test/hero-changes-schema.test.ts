import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { heroChanges } from "../src/db/schema/hero_changes.js";
import { heroes } from "../src/db/schema/heroes.js";
import { buildHeroRow } from "./factories.js";
import { getColumn, getIndexes } from "./information-schema.js";
import { startTestDatabase, type TestDatabase } from "./testcontainers.js";

// Contrato assumido para esta etapa (ainda não implementado):
// - `apps/api/src/db/schema/hero_changes.ts` exporta a tabela Drizzle
//   `heroChanges`, mapeada para a tabela `hero_changes`, com as colunas
//   `id, hero_id, event, field, old_value, new_value, created_at`, `event`
//   restrito a 5 valores (`created`, `updated`, `activated`, `inactivated`,
//   `deleted`), `created_at` DATETIME(3) e um índice cobrindo
//   `(hero_id, created_at, id)`, nessa ordem.
//
// Os cenários C3, C4 e C5 pedem a definição do SQL gerado pela migration.
// Em vez de parsear o arquivo .sql, este teste consulta o
// `information_schema` do próprio MySQL real do Testcontainers (já com as
// migrations aplicadas) — mesmo padrão de `heroes-schema.test.ts` e
// `mission-heroes-schema.test.ts`.

type HeroChangeInsert = typeof heroChanges.$inferInsert;

function buildHeroChangeRow(heroId: string, overrides: Partial<HeroChangeInsert> = {}): HeroChangeInsert {
  return {
    id: randomUUID(),
    hero_id: heroId,
    event: "updated",
    field: "nickname",
    old_value: "Nick antigo",
    new_value: "Nick novo",
    created_at: new Date("2024-05-01T11:00:00.000Z"),
    ...overrides,
  };
}

describe("schema de hero_changes (MySQL real via Testcontainers)", () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await startTestDatabase();
  }, 120_000);

  afterAll(async () => {
    await testDatabase.stop();
  }, 60_000);

  // Etapa 04 · C1.a — Dado o banco limpo (via Testcontainers), quando se
  // aplicam as migrations em sequência (heroes, hero_changes), então a
  // tabela `hero_changes` passa a existir sem erro: uma linha de histórico
  // válida (para um herói real) pode ser inserida pelo cliente Drizzle.
  it("existe e aceita inserir uma linha de histórico válida", async () => {
    const hero = buildHeroRow();
    await testDatabase.db.insert(heroes).values(hero);

    const change = buildHeroChangeRow(hero.id);
    await expect(testDatabase.db.insert(heroChanges).values(change)).resolves.toBeDefined();
  });

  // Etapa 04 · C2.a — Dado o banco com a migration aplicada, quando se
  // insere uma linha com `hero_id`, `event`, `field`, `old_value`,
  // `new_value` e `created_at` preenchidos, então a inserção é aceita e a
  // leitura devolve os mesmos valores em cada uma dessas colunas.
  it("insere e lê de volta os mesmos valores em hero_changes", async () => {
    const hero = buildHeroRow();
    await testDatabase.db.insert(heroes).values(hero);

    const change = buildHeroChangeRow(hero.id, {
      event: "updated",
      field: "main_power",
      old_value: "Força antiga",
      new_value: "Força nova",
    });
    await testDatabase.db.insert(heroChanges).values(change);

    const found = await testDatabase.db.select().from(heroChanges).where(eq(heroChanges.id, change.id));
    expect(found).toHaveLength(1);
    const read = found[0]!;

    expect(read.id).toBe(change.id);
    expect(read.hero_id).toBe(hero.id);
    expect(read.event).toBe("updated");
    expect(read.field).toBe("main_power");
    expect(read.old_value).toBe("Força antiga");
    expect(read.new_value).toBe("Força nova");
    expect(new Date(read.created_at as string | number | Date).toISOString()).toBe(
      change.created_at.toISOString(),
    );
  });

  // Etapa 04 · C3.a — Dado o banco com a migration aplicada, quando se
  // insere uma linha com `event = "renomeado"` (valor fora dos 5 válidos)
  // via SQL bruto, então o banco rejeita a inserção.
  it("rejeita inserir com event fora dos 5 valores válidos", async () => {
    const hero = buildHeroRow();
    await testDatabase.db.insert(heroes).values(hero);

    await expect(
      testDatabase.db.execute(
        sql`INSERT INTO hero_changes (id, hero_id, event, field, old_value, new_value, created_at)
            VALUES (${randomUUID()}, ${hero.id}, 'renomeado', 'nickname', 'a', 'b', '2024-05-01 11:00:00.000')`,
      ),
    ).rejects.toBeTruthy();
  });

  // Etapa 04 · C4.a — Dado o arquivo de migration SQL gerado (verificado via
  // information_schema do banco já migrado), quando se lê a definição de
  // `created_at`, então ela é DATETIME(3).
  it("define hero_changes.created_at como DATETIME(3)", async () => {
    const info = await getColumn(testDatabase.db, "hero_changes", "created_at");
    expect(info.COLUMN_TYPE).toBe("datetime(3)");
  });

  // Etapa 04 · C5.a — Dado o arquivo de migration SQL gerado (verificado via
  // information_schema), quando se lêem os índices da tabela
  // `hero_changes`, então existe um índice cobrindo exatamente
  // `(hero_id, created_at, id)`, nessa ordem.
  it("tem um índice cobrindo (hero_id, created_at, id) nessa ordem", async () => {
    const indexes = await getIndexes(testDatabase.db, "hero_changes");
    const expectedOrder = ["hero_id", "created_at", "id"];

    const matching = [...indexes.values()].find(
      (index) =>
        index.columns.length === expectedOrder.length &&
        index.columns.every((col, i) => col === expectedOrder[i]),
    );

    expect(matching).toBeDefined();
  });
});
