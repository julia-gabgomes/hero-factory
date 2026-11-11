import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { createDbClient, type DbClient } from "../../../src/db/client.js";
import { heroes } from "../../../src/db/schema/heroes.js";
import { idempotencyKeys } from "../../../src/db/schema/idempotency_keys.js";
import { missionHeroes } from "../../../src/db/schema/mission_heroes.js";
import { missions } from "../../../src/db/schema/missions.js";
import { startTestDatabase, type TestDatabase } from "../../testcontainers.js";

// Teste decisivo: duas instâncias `buildApp()` com pools (conexões MySQL)
// separados, apontando para o mesmo banco (mesmo container Testcontainers),
// como as duas instâncias `api1`/`api2` atrás do Nginx em produção. Os dois
// `POST /missions/:id/heroes` são disparados juntos (sem `await` entre eles),
// então o resultado depende só do lock `FOR UPDATE` no MySQL, nunca de
// estado compartilhado em memória — exatamente o que a topologia exige.

type MissionBody = { id: string };
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

function missionPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const suffix = randomUUID();
  return {
    title: `Missão de Teste ${suffix}`,
    starts_at: "2024-05-01T10:00:00.000Z",
    ends_at: "2024-05-01T12:00:00.000Z",
    ...overrides,
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

async function createMission(
  app: FastifyInstance,
  overrides: Record<string, unknown> = {},
): Promise<MissionBody> {
  const response = await app.inject({
    method: "POST",
    url: "/missions",
    headers: { "idempotency-key": randomUUID() },
    payload: missionPayload(overrides),
  });
  expect(response.statusCode).toBe(201);
  return response.json<MissionBody>();
}

function assignHero(app: FastifyInstance, missionId: string, heroId: string) {
  return app.inject({
    method: "POST",
    url: `/missions/${missionId}/heroes`,
    payload: { hero_id: heroId },
  });
}

describe("Escalação simultânea em duas instâncias da API (MySQL real via Testcontainers)", () => {
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

  it.each([1, 2, 3])(
    "rodada %i: exatamente 1 sucesso e 1 SCHEDULE_CONFLICT ao escalar o mesmo herói em duas missões sobrepostas, em instâncias diferentes",
    async () => {
      const hero = await createHero(app1);
      const missionA = await createMission(app1, {
        starts_at: "2024-05-01T10:00:00.000Z",
        ends_at: "2024-05-01T12:00:00.000Z",
      });
      const missionB = await createMission(app1, {
        starts_at: "2024-05-01T11:00:00.000Z",
        ends_at: "2024-05-01T13:00:00.000Z",
      });

      const [resultA, resultB] = await Promise.all([
        assignHero(app1, missionA.id, hero.id),
        assignHero(app2, missionB.id, hero.id),
      ]);

      const statusCodes = [resultA.statusCode, resultB.statusCode].sort(
        (a, b) => a - b,
      );
      expect(statusCodes).toEqual([201, 409]);

      const loser = resultA.statusCode === 409 ? resultA : resultB;
      expect(loser.json<{ error: { code: string } }>().error.code).toBe(
        "SCHEDULE_CONFLICT",
      );

      const assignedRows = await testDatabase.db
        .select()
        .from(missionHeroes)
        .where(eq(missionHeroes.hero_id, hero.id));
      expect(assignedRows).toHaveLength(1);
    },
  );

  it("permite escalar o mesmo herói em duas missões concorrentes quando uma termina exatamente quando a outra começa (12h-12h)", async () => {
    const hero = await createHero(app1);
    const missionA = await createMission(app1, {
      starts_at: "2024-05-01T10:00:00.000Z",
      ends_at: "2024-05-01T12:00:00.000Z",
    });
    const missionB = await createMission(app1, {
      starts_at: "2024-05-01T12:00:00.000Z",
      ends_at: "2024-05-01T14:00:00.000Z",
    });

    const [resultA, resultB] = await Promise.all([
      assignHero(app1, missionA.id, hero.id),
      assignHero(app2, missionB.id, hero.id),
    ]);

    expect([resultA.statusCode, resultB.statusCode].sort()).toEqual([201, 201]);

    const assignedRows = await testDatabase.db
      .select()
      .from(missionHeroes)
      .where(eq(missionHeroes.hero_id, hero.id));
    expect(assignedRows).toHaveLength(2);
  });
});
