import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { heroChanges } from "./hero_changes.js";
import { heroes } from "./heroes.js";
import { buildHeroRow } from "../../test-support/factories.js";
import { getColumn, getIndexes } from "../../test-support/information-schema.js";
import { startTestDatabase, type TestDatabase } from "../../test-support/testcontainers.js";

type HeroChangeInsert = typeof heroChanges.$inferInsert;

function buildHeroChangeRow(
  heroId: string,
  overrides: Partial<HeroChangeInsert> = {},
): HeroChangeInsert {
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

  it("existe e aceita inserir uma linha de histórico válida", async () => {
    const hero = buildHeroRow();
    await testDatabase.db.insert(heroes).values(hero);

    const change = buildHeroChangeRow(hero.id);
    await expect(
      testDatabase.db.insert(heroChanges).values(change),
    ).resolves.toBeDefined();
  });

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

    const found = await testDatabase.db
      .select()
      .from(heroChanges)
      .where(eq(heroChanges.id, change.id));
    expect(found).toHaveLength(1);
    const read = found[0]!;

    expect(read.id).toBe(change.id);
    expect(read.hero_id).toBe(hero.id);
    expect(read.event).toBe("updated");
    expect(read.field).toBe("main_power");
    expect(read.old_value).toBe("Força antiga");
    expect(read.new_value).toBe("Força nova");
    expect(
      new Date(read.created_at as string | number | Date).toISOString(),
    ).toBe(change.created_at.toISOString());
  });

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

  it("define hero_changes.created_at como DATETIME(3)", async () => {
    const info = await getColumn(testDatabase.db, "hero_changes", "created_at");
    expect(info.COLUMN_TYPE).toBe("datetime(3)");
  });

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
