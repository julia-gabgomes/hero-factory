import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { heroes } from "../src/db/schema/heroes.js";
import { missionHeroes } from "../src/db/schema/mission_heroes.js";
import { missions } from "../src/db/schema/missions.js";
import { buildHeroRow, buildMissionRow } from "./factories.js";
import {
  getForeignKeys,
  getIndexes,
  getPrimaryKeyColumns,
} from "./information-schema.js";
import { startTestDatabase, type TestDatabase } from "./testcontainers.js";

describe("schema de mission_heroes (MySQL real via Testcontainers)", () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await startTestDatabase();
  }, 120_000);

  afterAll(async () => {
    await testDatabase.stop();
  }, 60_000);

  it("existe e aceita inserir e ler uma escalação válida", async () => {
    const mission = buildMissionRow();
    const hero = buildHeroRow();
    await testDatabase.db.insert(missions).values(mission);
    await testDatabase.db.insert(heroes).values(hero);

    await testDatabase.db
      .insert(missionHeroes)
      .values({ mission_id: mission.id, hero_id: hero.id });

    const found = await testDatabase.db
      .select()
      .from(missionHeroes)
      .where(sql`mission_id = ${mission.id} AND hero_id = ${hero.id}`);
    expect(found).toHaveLength(1);
    expect(found[0]!.mission_id).toBe(mission.id);
    expect(found[0]!.hero_id).toBe(hero.id);
  });

  it("tem a PK composta por (mission_id, hero_id)", async () => {
    const pkColumns = await getPrimaryKeyColumns(
      testDatabase.db,
      "mission_heroes",
    );
    expect(pkColumns).toEqual(["mission_id", "hero_id"]);
  });

  it("tem FOREIGN KEY de mission_id -> missions.id e hero_id -> heroes.id", async () => {
    const foreignKeys = await getForeignKeys(testDatabase.db, "mission_heroes");

    expect(
      foreignKeys.some(
        (fk) =>
          fk.COLUMN_NAME === "mission_id" &&
          fk.REFERENCED_TABLE_NAME === "missions" &&
          fk.REFERENCED_COLUMN_NAME === "id",
      ),
    ).toBe(true);
    expect(
      foreignKeys.some(
        (fk) =>
          fk.COLUMN_NAME === "hero_id" &&
          fk.REFERENCED_TABLE_NAME === "heroes" &&
          fk.REFERENCED_COLUMN_NAME === "id",
      ),
    ).toBe(true);
  });

  it("rejeita inserir com hero_id inexistente", async () => {
    const mission = buildMissionRow();
    await testDatabase.db.insert(missions).values(mission);

    await expect(
      testDatabase.db
        .insert(missionHeroes)
        .values({ mission_id: mission.id, hero_id: randomUUID() }),
    ).rejects.toBeTruthy();
  });

  it("rejeita inserir com mission_id inexistente", async () => {
    const hero = buildHeroRow();
    await testDatabase.db.insert(heroes).values(hero);

    await expect(
      testDatabase.db
        .insert(missionHeroes)
        .values({ mission_id: randomUUID(), hero_id: hero.id }),
    ).rejects.toBeTruthy();
  });

  it("tem um índice cobrindo (hero_id)", async () => {
    const indexes = await getIndexes(testDatabase.db, "mission_heroes");

    const matching = [...indexes.entries()].find(
      ([name, index]) =>
        name !== "PRIMARY" &&
        index.columns.length === 1 &&
        index.columns[0] === "hero_id",
    );

    expect(matching).toBeDefined();
  });

  it("rejeita escalar o mesmo herói duas vezes na mesma missão", async () => {
    const mission = buildMissionRow();
    const hero = buildHeroRow();
    await testDatabase.db.insert(missions).values(mission);
    await testDatabase.db.insert(heroes).values(hero);

    await testDatabase.db
      .insert(missionHeroes)
      .values({ mission_id: mission.id, hero_id: hero.id });

    await expect(
      testDatabase.db
        .insert(missionHeroes)
        .values({ mission_id: mission.id, hero_id: hero.id }),
    ).rejects.toMatchObject({
      cause: { code: "ER_DUP_ENTRY" },
    });
  });
});
