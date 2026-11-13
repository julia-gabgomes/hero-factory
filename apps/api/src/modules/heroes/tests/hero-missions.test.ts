import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../../app.js";
import { heroes } from "../../../db/schema/heroes.js";
import { idempotencyKeys } from "../../../db/schema/idempotency_keys.js";
import { missionHeroes } from "../../../db/schema/mission_heroes.js";
import { missions } from "../../../db/schema/missions.js";
import { startTestDatabase, type TestDatabase } from "../../../test-support/testcontainers.js";

type HeroBody = { id: string; version: number };
type MissionBody = { id: string; title: string; status: string };
type MissionsPage = { data: MissionBody[]; next_cursor: string | null };

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

// As missões aqui são todas escaladas para o mesmo herói, então cada
// chamada precisa de um horário que não se sobreponha às anteriores
// (senão a própria API rejeitaria com SCHEDULE_CONFLICT, corretamente).
let missionSequence = 0;

function missionPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  missionSequence += 1;
  const startsAt = new Date(
    Date.UTC(2024, 4, 1, 0, 0, 0) + missionSequence * 3 * 60 * 60 * 1000,
  );
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
  const suffix = randomUUID();
  return {
    title: `Missão de Teste ${suffix}`,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
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

async function assignHero(
  app: FastifyInstance,
  missionId: string,
  heroId: string,
): Promise<void> {
  const response = await app.inject({
    method: "POST",
    url: `/missions/${missionId}/heroes`,
    payload: { hero_id: heroId },
  });
  expect(response.statusCode).toBe(201);
}

describe("GET /heroes/:id/missions (MySQL real via Testcontainers)", () => {
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

  it("lista as missões do herói com a situação de cada uma", async () => {
    const hero = await createHero(app);

    const scheduled = await createMission(app);
    await assignHero(app, scheduled.id, hero.id);

    const succeeded = await createMission(app);
    await assignHero(app, succeeded.id, hero.id);
    await app.inject({
      method: "POST",
      url: `/missions/${succeeded.id}/start`,
    });
    await app.inject({
      method: "POST",
      url: `/missions/${succeeded.id}/finish`,
      payload: { outcome: "succeeded" },
    });

    const cancelled = await createMission(app);
    await assignHero(app, cancelled.id, hero.id);
    await app.inject({
      method: "POST",
      url: `/missions/${cancelled.id}/cancel`,
    });

    const response = await app.inject({
      method: "GET",
      url: `/heroes/${hero.id}/missions`,
    });

    expect(response.statusCode).toBe(200);
    const page = response.json<MissionsPage>();
    const ids = page.data.map((mission) => mission.id);

    expect(ids).toContain(scheduled.id);
    expect(ids).toContain(succeeded.id);
    expect(ids).toContain(cancelled.id);

    const succeededEntry = page.data.find(
      (mission) => mission.id === succeeded.id,
    );
    expect(succeededEntry?.status).toBe("succeeded");
  });

  it("filtra as missões do herói por situação", async () => {
    const hero = await createHero(app);

    const scheduled = await createMission(app);
    await assignHero(app, scheduled.id, hero.id);

    const failed = await createMission(app);
    await assignHero(app, failed.id, hero.id);
    await app.inject({ method: "POST", url: `/missions/${failed.id}/start` });
    await app.inject({
      method: "POST",
      url: `/missions/${failed.id}/finish`,
      payload: { outcome: "failed" },
    });

    const response = await app.inject({
      method: "GET",
      url: `/heroes/${hero.id}/missions?status=failed`,
    });

    expect(response.statusCode).toBe(200);
    const page = response.json<MissionsPage>();
    expect(page.data).toHaveLength(1);
    expect(page.data[0]?.id).toBe(failed.id);
  });

  it("pagina as missões do herói", async () => {
    const hero = await createHero(app);

    for (let i = 0; i < 12; i += 1) {
      const mission = await createMission(app);
      await assignHero(app, mission.id, hero.id);
    }

    const firstPage = await app.inject({
      method: "GET",
      url: `/heroes/${hero.id}/missions`,
    });
    expect(firstPage.statusCode).toBe(200);
    const firstBody = firstPage.json<MissionsPage>();
    expect(firstBody.data).toHaveLength(10);
    expect(firstBody.next_cursor).toBeTruthy();

    const secondPage = await app.inject({
      method: "GET",
      url: `/heroes/${hero.id}/missions?cursor=${firstBody.next_cursor}`,
    });
    expect(secondPage.statusCode).toBe(200);
    const secondBody = secondPage.json<MissionsPage>();
    expect(secondBody.data).toHaveLength(2);

    const allIds = new Set([
      ...firstBody.data.map((m) => m.id),
      ...secondBody.data.map((m) => m.id),
    ]);
    expect(allIds.size).toBe(12);
  });

  it("continua mostrando as missões mesmo depois do herói ser excluído", async () => {
    const hero = await createHero(app);
    const mission = await createMission(app);
    await assignHero(app, mission.id, hero.id);

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/heroes/${hero.id}`,
      payload: { version: hero.version },
    });
    expect(deleteResponse.statusCode).toBe(200);

    const response = await app.inject({
      method: "GET",
      url: `/heroes/${hero.id}/missions`,
    });

    expect(response.statusCode).toBe(200);
    const page = response.json<MissionsPage>();
    expect(page.data.map((m) => m.id)).toContain(mission.id);
  });
});
