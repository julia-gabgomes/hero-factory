import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { heroes } from "./schema/heroes.js";
import { TOTAL_SEED_HEROES, runSeed } from "./seed.js";
import { startTestDatabase, type TestDatabase } from "../test-support/testcontainers.js";

describe("seed de heróis (MySQL real via Testcontainers)", () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await startTestDatabase();
  }, 120_000);

  afterAll(async () => {
    await testDatabase.stop();
  }, 60_000);

  it("gera 100000 heróis e não duplica ao rodar de novo", async () => {
    const firstRun = await runSeed(testDatabase.db);
    expect(firstRun).toBe(TOTAL_SEED_HEROES);

    const [afterFirst] = await testDatabase.db
      .select({ count: sql<number>`count(*)` })
      .from(heroes);
    expect(Number(afterFirst?.count)).toBe(TOTAL_SEED_HEROES);

    const secondRun = await runSeed(testDatabase.db);
    expect(secondRun).toBe(0);

    const [afterSecond] = await testDatabase.db
      .select({ count: sql<number>`count(*)` })
      .from(heroes);
    expect(Number(afterSecond?.count)).toBe(TOTAL_SEED_HEROES);
  }, 180_000);

  it("inclui os grupos de busca usados pelo benchmark (Thor comum, Zorblatt raro, sem Nonexistentus)", async () => {
    await runSeed(testDatabase.db);

    const thorRows = await testDatabase.db
      .select({ count: sql<number>`count(*)` })
      .from(heroes)
      .where(sql`${heroes.name} LIKE '%Thor%'`);
    expect(Number(thorRows[0]?.count)).toBeGreaterThan(1000);

    const zorblattRows = await testDatabase.db
      .select({ count: sql<number>`count(*)` })
      .from(heroes)
      .where(sql`${heroes.name} LIKE '%Zorblatt%'`);
    expect(Number(zorblattRows[0]?.count)).toBe(1);

    const missRows = await testDatabase.db
      .select({ count: sql<number>`count(*)` })
      .from(heroes)
      .where(sql`${heroes.name} LIKE '%Nonexistentus%'`);
    expect(Number(missRows[0]?.count)).toBe(0);
  }, 180_000);
});
