import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../../app.js";
import { heroes } from "../../../db/schema/heroes.js";
import { idempotencyKeys } from "../../../db/schema/idempotency_keys.js";
import { missionHeroes } from "../../../db/schema/mission_heroes.js";
import { missions } from "../../../db/schema/missions.js";
import { startTestDatabase, type TestDatabase } from "../../../test-support/testcontainers.js";

type MissionBody = { id: string; title: string };
type HeroBody = { id: string; version: number };
type ErrorBody = {
  error: { code: string; details?: { mission?: { id: string } } };
};

function heroPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const suffix = randomUUID();
  return {
    name: `Herói de Teste ${suffix}`,
    nickname: `Nick ${suffix}`,
    universe: "Universo de teste",
    main_power: "Força sobre-humana",
    date_of_birth: "1990-06-18",
    ...overrides,
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

async function createHero(
  app: FastifyInstance,
  overrides: Record<string, unknown> = {},
): Promise<HeroBody> {
  const response = await app.inject({
    method: "POST",
    url: "/heroes",
    headers: { "idempotency-key": randomUUID() },
    payload: heroPayload(overrides),
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

async function assignHero(
  app: FastifyInstance,
  missionId: string,
  heroId: string,
) {
  return app.inject({
    method: "POST",
    url: `/missions/${missionId}/heroes`,
    payload: { hero_id: heroId },
  });
}

describe("Escalação de herói e choque de horário (MySQL real via Testcontainers)", () => {
  let testDatabase: TestDatabase;
  let app: FastifyInstance;

  beforeAll(async () => {
    testDatabase = await startTestDatabase();
    app = buildApp({ db: testDatabase.db });
    await app.ready();
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await testDatabase.stop();
  }, 60_000);

  afterEach(async () => {
    await testDatabase.db.delete(idempotencyKeys);
    await testDatabase.db.delete(missionHeroes);
    await testDatabase.db.delete(missions);
    await testDatabase.db.delete(heroes);
  });

  it("devolve 404 NOT_FOUND ao escalar um herói inexistente", async () => {
    const mission = await createMission(app);

    const response = await assignHero(app, mission.id, randomUUID());

    expect(response.statusCode).toBe(404);
    expect(response.json<ErrorBody>().error.code).toBe("NOT_FOUND");
  });

  it("devolve 404 NOT_FOUND ao escalar um herói excluído", async () => {
    const mission = await createMission(app);
    const hero = await createHero(app);
    await app.inject({
      method: "DELETE",
      url: `/heroes/${hero.id}`,
      payload: { version: hero.version },
    });

    const response = await assignHero(app, mission.id, hero.id);

    expect(response.statusCode).toBe(404);
    expect(response.json<ErrorBody>().error.code).toBe("NOT_FOUND");
  });

  it("devolve 409 INVALID_STATE ao escalar um herói inativo", async () => {
    const mission = await createMission(app);
    const hero = await createHero(app);
    await app.inject({
      method: "POST",
      url: `/heroes/${hero.id}/deactivate`,
      payload: { version: hero.version },
    });

    const response = await assignHero(app, mission.id, hero.id);

    expect(response.statusCode).toBe(409);
    expect(response.json<ErrorBody>().error.code).toBe("INVALID_STATE");
  });

  it("escala o herói com sucesso numa missão agendada", async () => {
    const mission = await createMission(app);
    const hero = await createHero(app);

    const response = await assignHero(app, mission.id, hero.id);

    expect(response.statusCode).toBe(201);
    const body = response.json<{ heroes: Array<{ id: string }> }>();
    expect(body.heroes.map((h) => h.id)).toContain(hero.id);
  });

  it("devolve 409 SCHEDULE_CONFLICT quando os horários das missões se sobrepõem", async () => {
    const hero = await createHero(app);
    const missionA = await createMission(app, {
      starts_at: "2024-05-01T10:00:00.000Z",
      ends_at: "2024-05-01T12:00:00.000Z",
    });
    const missionB = await createMission(app, {
      starts_at: "2024-05-01T11:00:00.000Z",
      ends_at: "2024-05-01T13:00:00.000Z",
    });

    const first = await assignHero(app, missionA.id, hero.id);
    expect(first.statusCode).toBe(201);

    const second = await assignHero(app, missionB.id, hero.id);

    expect(second.statusCode).toBe(409);
    const body = second.json<ErrorBody>();
    expect(body.error.code).toBe("SCHEDULE_CONFLICT");
    expect(body.error.details?.mission?.id).toBe(missionA.id);
  });

  it("não considera choque quando uma missão termina exatamente quando a outra começa (12h-12h)", async () => {
    const hero = await createHero(app);
    const missionA = await createMission(app, {
      starts_at: "2024-05-01T10:00:00.000Z",
      ends_at: "2024-05-01T12:00:00.000Z",
    });
    const missionB = await createMission(app, {
      starts_at: "2024-05-01T12:00:00.000Z",
      ends_at: "2024-05-01T14:00:00.000Z",
    });

    const first = await assignHero(app, missionA.id, hero.id);
    expect(first.statusCode).toBe(201);

    const second = await assignHero(app, missionB.id, hero.id);

    expect(second.statusCode).toBe(201);
  });
});
