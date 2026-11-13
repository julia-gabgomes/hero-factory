import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../../app.js";
import { createDbClient, type DbClient } from "../../../db/client.js";
import { heroes } from "../../../db/schema/heroes.js";
import { idempotencyKeys } from "../../../db/schema/idempotency_keys.js";
import { missionHeroes } from "../../../db/schema/mission_heroes.js";
import { missions } from "../../../db/schema/missions.js";
import { startTestDatabase, type TestDatabase } from "../../../test-support/testcontainers.js";

// "Remover herói também trava a missão": a remoção do último herói e o
// início da missão disputam o mesmo lock `FOR UPDATE` na linha da missão,
// em instâncias separadas da API. Nunca os dois podem vencer.

type MissionBody = { id: string; status: string };
type HeroBody = { id: string };

function heroPayload(): Record<string, unknown> {
  const suffix = randomUUID();
  return {
    name: `Herói de Teste ${suffix}`,
    nickname: `Nick ${suffix}`,
    universe: "Universo de teste",
    main_power: "Força sobre-humana",
    date_of_birth: "1990-06-18",
  };
}

function missionPayload(): Record<string, unknown> {
  const suffix = randomUUID();
  return {
    title: `Missão de Teste ${suffix}`,
    starts_at: "2024-05-01T10:00:00.000Z",
    ends_at: "2024-05-01T12:00:00.000Z",
  };
}

async function createHero(app: FastifyInstance): Promise<HeroBody> {
  const response = await app.inject({
    method: "POST",
    url: "/heroes",
    headers: { "idempotency-key": randomUUID() },
    payload: heroPayload(),
  });
  expect(response.statusCode).toBe(201);
  return response.json<HeroBody>();
}

async function createMission(app: FastifyInstance): Promise<MissionBody> {
  const response = await app.inject({
    method: "POST",
    url: "/missions",
    headers: { "idempotency-key": randomUUID() },
    payload: missionPayload(),
  });
  expect(response.statusCode).toBe(201);
  return response.json<MissionBody>();
}

describe("Corrida entre start e remoção do último herói (MySQL real via Testcontainers)", () => {
  let testDatabase: TestDatabase;
  let app1: FastifyInstance;
  let app2: FastifyInstance;
  let secondaryClient: DbClient;

  beforeAll(async () => {
    testDatabase = await startTestDatabase();
    app1 = buildApp({ db: testDatabase.db });
    await app1.ready();

    secondaryClient = createDbClient(testDatabase.connectionUri);
    app2 = buildApp({ db: secondaryClient.db });
    await app2.ready();
  }, 120_000);

  afterAll(async () => {
    await app1.close();
    await app2.close();
    await secondaryClient.pool.end();
    await testDatabase.stop();
  }, 60_000);

  afterEach(async () => {
    await testDatabase.db.delete(idempotencyKeys);
    await testDatabase.db.delete(missionHeroes);
    await testDatabase.db.delete(missions);
    await testDatabase.db.delete(heroes);
  });

  it("exatamente um dos dois vence: iniciar a missão ou remover o único herói escalado", async () => {
    const mission = await createMission(app1);
    const hero = await createHero(app1);
    const assign = await app1.inject({
      method: "POST",
      url: `/missions/${mission.id}/heroes`,
      payload: { hero_id: hero.id },
    });
    expect(assign.statusCode).toBe(201);

    const [startResult, unassignResult] = await Promise.all([
      app1.inject({ method: "POST", url: `/missions/${mission.id}/start` }),
      app2.inject({
        method: "DELETE",
        url: `/missions/${mission.id}/heroes/${hero.id}`,
      }),
    ]);

    const outcomes = [startResult.statusCode, unassignResult.statusCode];

    const startWon = startResult.statusCode === 200;
    const unassignWon = unassignResult.statusCode === 200;

    expect(startWon !== unassignWon).toBe(true);

    if (startWon) {
      expect(unassignResult.statusCode).toBe(409);
      expect(
        unassignResult.json<{ error: { code: string } }>().error.code,
      ).toBe("INVALID_STATE");
    } else {
      expect(startResult.statusCode).toBe(409);
      expect(startResult.json<{ error: { code: string } }>().error.code).toBe(
        "INVALID_STATE",
      );
    }

    expect(outcomes.sort()).toEqual([200, 409]);
  });
});
