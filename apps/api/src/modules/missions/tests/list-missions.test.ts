import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../../app.js";
import { heroes } from "../../../db/schema/heroes.js";
import { idempotencyKeys } from "../../../db/schema/idempotency_keys.js";
import { missionHeroes } from "../../../db/schema/mission_heroes.js";
import { missions } from "../../../db/schema/missions.js";
import { startTestDatabase, type TestDatabase } from "../../../test-support/testcontainers.js";

type HeroBody = { id: string; nickname: string };
type MissionBody = { id: string; title: string; status: string };
type MissionListItemBody = MissionBody & {
  assigned_heroes: { id: string; nickname: string }[];
  assigned_heroes_total: number;
};
type MissionsPage = { data: MissionListItemBody[]; next_cursor: string | null };
type ErrorBody = { error: { code: string; fields: Record<string, string> | null } };

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

// Cada missão criada aqui é escalada para um herói diferente, então não há
// risco de SCHEDULE_CONFLICT mesmo reaproveitando o mesmo horário.
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

async function createMissionWithStatus(
  app: FastifyInstance,
  status: "scheduled" | "succeeded" | "failed" | "cancelled",
): Promise<MissionBody> {
  const mission = await createMission(app);

  if (status === "scheduled") {
    return mission;
  }

  const hero = await createHero(app);
  await assignHero(app, mission.id, hero.id);

  if (status === "cancelled") {
    const response = await app.inject({
      method: "POST",
      url: `/missions/${mission.id}/cancel`,
    });
    expect(response.statusCode).toBe(200);
    return { ...mission, status: "cancelled" };
  }

  await app.inject({ method: "POST", url: `/missions/${mission.id}/start` });
  const response = await app.inject({
    method: "POST",
    url: `/missions/${mission.id}/finish`,
    payload: { outcome: status },
  });
  expect(response.statusCode).toBe(200);

  return { ...mission, status };
}

describe("GET /missions (MySQL real via Testcontainers)", () => {
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

  it("sem status, lista missões de todas as situações", async () => {
    const scheduled = await createMissionWithStatus(app, "scheduled");
    const succeeded = await createMissionWithStatus(app, "succeeded");
    const failed = await createMissionWithStatus(app, "failed");

    const response = await app.inject({ method: "GET", url: "/missions" });
    expect(response.statusCode).toBe(200);
    const page = response.json<MissionsPage>();
    const ids = page.data.map((mission) => mission.id);

    expect(ids).toContain(scheduled.id);
    expect(ids).toContain(succeeded.id);
    expect(ids).toContain(failed.id);
  });

  it("filtra por um único status", async () => {
    const scheduled = await createMissionWithStatus(app, "scheduled");
    await createMissionWithStatus(app, "succeeded");

    const response = await app.inject({
      method: "GET",
      url: "/missions?status=scheduled",
    });

    expect(response.statusCode).toBe(200);
    const page = response.json<MissionsPage>();
    expect(page.data).toHaveLength(1);
    expect(page.data[0]?.id).toBe(scheduled.id);
  });

  it("filtra pela união de múltiplos status, excluindo os demais", async () => {
    const scheduled = await createMissionWithStatus(app, "scheduled");
    const failed = await createMissionWithStatus(app, "failed");
    await createMissionWithStatus(app, "succeeded");

    const response = await app.inject({
      method: "GET",
      url: "/missions?status=scheduled,failed",
    });

    expect(response.statusCode).toBe(200);
    const page = response.json<MissionsPage>();
    const ids = page.data.map((mission) => mission.id);

    expect(ids).toHaveLength(2);
    expect(ids).toContain(scheduled.id);
    expect(ids).toContain(failed.id);
  });

  it("rejeita um status inválido com 422 VALIDATION_ERROR apontando o campo", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/missions?status=invalida",
    });

    expect(response.statusCode).toBe(422);
    const body = response.json<ErrorBody>();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(
      Object.keys(body.error.fields ?? {}).some((field) =>
        field.startsWith("status"),
      ),
    ).toBe(true);
  });

  it("mantém o filtro de status ao paginar", async () => {
    for (let i = 0; i < 11; i += 1) {
      await createMissionWithStatus(app, "scheduled");
    }
    await createMissionWithStatus(app, "succeeded");

    const firstPage = await app.inject({
      method: "GET",
      url: "/missions?status=scheduled",
    });
    expect(firstPage.statusCode).toBe(200);
    const firstBody = firstPage.json<MissionsPage>();
    expect(firstBody.data).toHaveLength(10);
    expect(firstBody.data.every((mission) => mission.status === "scheduled")).toBe(
      true,
    );
    expect(firstBody.next_cursor).toBeTruthy();

    const secondPage = await app.inject({
      method: "GET",
      url: `/missions?status=scheduled&cursor=${firstBody.next_cursor}`,
    });
    expect(secondPage.statusCode).toBe(200);
    const secondBody = secondPage.json<MissionsPage>();
    expect(secondBody.data).toHaveLength(1);
    expect(secondBody.data[0]?.status).toBe("scheduled");
  });

  it("traz uma missão sem herói escalado com assigned_heroes vazio e total 0", async () => {
    const mission = await createMission(app);

    const response = await app.inject({ method: "GET", url: "/missions" });
    expect(response.statusCode).toBe(200);
    const page = response.json<MissionsPage>();
    const item = page.data.find((entry) => entry.id === mission.id);

    expect(item?.assigned_heroes).toEqual([]);
    expect(item?.assigned_heroes_total).toBe(0);
  });

  it("traz os heróis escalados (até o limite da prévia) e o total correto quando há mais que isso", async () => {
    const mission = await createMission(app);
    const heroesList: HeroBody[] = [];
    for (let i = 0; i < 4; i += 1) {
      const hero = await createHero(app);
      await assignHero(app, mission.id, hero.id);
      heroesList.push(hero);
    }

    const response = await app.inject({ method: "GET", url: "/missions" });
    expect(response.statusCode).toBe(200);
    const page = response.json<MissionsPage>();
    const item = page.data.find((entry) => entry.id === mission.id);

    expect(item?.assigned_heroes_total).toBe(4);
    expect(item?.assigned_heroes).toHaveLength(3);
    const previewIds = item?.assigned_heroes.map((hero) => hero.id) ?? [];
    expect(
      previewIds.every((id) =>
        heroesList.some((hero) => hero.id === id),
      ),
    ).toBe(true);
  });
});
