import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../../app.js";
import { heroes } from "../../../db/schema/heroes.js";
import { idempotencyKeys } from "../../../db/schema/idempotency_keys.js";
import { startTestDatabase, type TestDatabase } from "../../../test-support/testcontainers.js";

function validCreatePayload(
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

async function createHero(
  app: FastifyInstance,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; name: string }> {
  const response = await app.inject({
    method: "POST",
    url: "/heroes",
    headers: { "idempotency-key": randomUUID() },
    payload: validCreatePayload(overrides),
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: string; name: string }>();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("GET /heroes (MySQL real via Testcontainers)", () => {
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
    await testDatabase.db.delete(heroes);
  });

  it("lista os heróis com o mais novo primeiro", async () => {
    const heroA = await createHero(app);
    await sleep(10);
    const heroB = await createHero(app);
    await sleep(10);
    const heroC = await createHero(app);

    const response = await app.inject({ method: "GET", url: "/heroes" });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: Array<{ id: string }> }>();
    const ids = body.data.map((hero) => hero.id);

    expect(ids).toEqual([heroC.id, heroB.id, heroA.id]);
  });

  it("devolve no máximo 10 heróis por página", async () => {
    for (let index = 0; index < 15; index += 1) {
      await createHero(app);
    }

    const response = await app.inject({ method: "GET", url: "/heroes" });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: unknown[] }>();
    expect(body.data).toHaveLength(10);
  });

  it("não lista heróis com deleted_at preenchido", async () => {
    const activeHero = await createHero(app);

    const deletedId = randomUUID();
    const now = new Date();
    await testDatabase.db.insert(heroes).values({
      id: deletedId,
      name: `Herói Excluído ${deletedId}`,
      nickname: `Nick ${deletedId}`,
      universe: "Universo de teste",
      main_power: "Força sobre-humana",
      date_of_birth: "1990-06-18",
      is_active: true,
      deleted_at: now,
      version: 1,
      created_at: now,
      updated_at: now,
    });

    const response = await app.inject({ method: "GET", url: "/heroes" });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: Array<{ id: string }> }>();
    const ids = body.data.map((hero) => hero.id);

    expect(ids).toEqual([activeHero.id]);
  });

  it("devolve lista vazia quando não há nenhum herói cadastrado", async () => {
    const response = await app.inject({ method: "GET", url: "/heroes" });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: unknown[] }>();
    expect(body.data).toEqual([]);
  });
});
