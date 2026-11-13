import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../../app.js";
import { heroes } from "../../../db/schema/heroes.js";
import { idempotencyKeys } from "../../../db/schema/idempotency_keys.js";
import { missionHeroes } from "../../../db/schema/mission_heroes.js";
import { missions } from "../../../db/schema/missions.js";
import { startTestDatabase, type TestDatabase } from "../../../test-support/testcontainers.js";

type MissionBody = {
  id: string;
  title: string;
  status: string;
  starts_at: string;
  ends_at: string;
};

type HeroBody = { id: string };

type ErrorBody = { error: { code: string } };

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

describe("Máquina de estados da missão (MySQL real via Testcontainers)", () => {
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

  it("devolve 409 INVALID_STATE ao iniciar uma missão sem nenhum herói escalado", async () => {
    const mission = await createMission(app);

    const response = await app.inject({
      method: "POST",
      url: `/missions/${mission.id}/start`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<ErrorBody>().error.code).toBe("INVALID_STATE");
  });

  it("inicia a missão com pelo menos um herói escalado", async () => {
    const mission = await createMission(app);
    const hero = await createHero(app);
    const assign = await assignHero(app, mission.id, hero.id);
    expect(assign.statusCode).toBe(201);

    const response = await app.inject({
      method: "POST",
      url: `/missions/${mission.id}/start`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<MissionBody>().status).toBe("in_progress");
  });

  it("devolve 409 INVALID_STATE ao iniciar uma missão que já está em andamento", async () => {
    const mission = await createMission(app);
    const hero = await createHero(app);
    await assignHero(app, mission.id, hero.id);
    const firstStart = await app.inject({
      method: "POST",
      url: `/missions/${mission.id}/start`,
    });
    expect(firstStart.statusCode).toBe(200);

    const secondStart = await app.inject({
      method: "POST",
      url: `/missions/${mission.id}/start`,
    });

    expect(secondStart.statusCode).toBe(409);
    expect(secondStart.json<ErrorBody>().error.code).toBe("INVALID_STATE");
  });

  it("devolve 409 INVALID_STATE ao encerrar uma missão que ainda não está em andamento", async () => {
    const mission = await createMission(app);

    const response = await app.inject({
      method: "POST",
      url: `/missions/${mission.id}/finish`,
      payload: { outcome: "succeeded" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<ErrorBody>().error.code).toBe("INVALID_STATE");
  });

  it.each(["succeeded", "failed"] as const)(
    "encerra a missão em andamento com outcome %s",
    async (outcome) => {
      const mission = await createMission(app);
      const hero = await createHero(app);
      await assignHero(app, mission.id, hero.id);
      await app.inject({
        method: "POST",
        url: `/missions/${mission.id}/start`,
      });

      const response = await app.inject({
        method: "POST",
        url: `/missions/${mission.id}/finish`,
        payload: { outcome },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<MissionBody>().status).toBe(outcome);
    },
  );

  it("cancela uma missão agendada", async () => {
    const mission = await createMission(app);

    const response = await app.inject({
      method: "POST",
      url: `/missions/${mission.id}/cancel`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<MissionBody>().status).toBe("cancelled");
  });

  it("cancela uma missão em andamento", async () => {
    const mission = await createMission(app);
    const hero = await createHero(app);
    await assignHero(app, mission.id, hero.id);
    await app.inject({ method: "POST", url: `/missions/${mission.id}/start` });

    const response = await app.inject({
      method: "POST",
      url: `/missions/${mission.id}/cancel`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<MissionBody>().status).toBe("cancelled");
  });

  it("devolve 409 INVALID_STATE ao cancelar uma missão já encerrada", async () => {
    const mission = await createMission(app);
    const hero = await createHero(app);
    await assignHero(app, mission.id, hero.id);
    await app.inject({ method: "POST", url: `/missions/${mission.id}/start` });
    await app.inject({
      method: "POST",
      url: `/missions/${mission.id}/finish`,
      payload: { outcome: "succeeded" },
    });

    const response = await app.inject({
      method: "POST",
      url: `/missions/${mission.id}/cancel`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<ErrorBody>().error.code).toBe("INVALID_STATE");
  });

  it("devolve 409 INVALID_STATE ao escalar herói numa missão que não está agendada", async () => {
    const mission = await createMission(app);
    const hero = await createHero(app);
    await assignHero(app, mission.id, hero.id);
    await app.inject({ method: "POST", url: `/missions/${mission.id}/start` });

    const otherHero = await createHero(app);
    const response = await assignHero(app, mission.id, otherHero.id);

    expect(response.statusCode).toBe(409);
    expect(response.json<ErrorBody>().error.code).toBe("INVALID_STATE");
  });

  it("devolve 409 INVALID_STATE ao remover herói de uma missão que não está agendada", async () => {
    const mission = await createMission(app);
    const hero = await createHero(app);
    await assignHero(app, mission.id, hero.id);
    await app.inject({ method: "POST", url: `/missions/${mission.id}/start` });

    const response = await app.inject({
      method: "DELETE",
      url: `/missions/${mission.id}/heroes/${hero.id}`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<ErrorBody>().error.code).toBe("INVALID_STATE");
  });

  it("remove o herói escalado enquanto a missão está agendada", async () => {
    const mission = await createMission(app);
    const hero = await createHero(app);
    await assignHero(app, mission.id, hero.id);

    const response = await app.inject({
      method: "DELETE",
      url: `/missions/${mission.id}/heroes/${hero.id}`,
    });

    expect(response.statusCode).toBe(200);

    const startResponse = await app.inject({
      method: "POST",
      url: `/missions/${mission.id}/start`,
    });
    expect(startResponse.statusCode).toBe(409);
    expect(startResponse.json<ErrorBody>().error.code).toBe("INVALID_STATE");
  });
});
