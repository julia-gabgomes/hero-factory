import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { v7 as uuidv7 } from "uuid";
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

describe("GET /heroes com busca e paginação por cursor (MySQL real via Testcontainers)", () => {
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

  it("encontra herói pelo name buscando sem acento e em minúsculas, e exclui quem não combina", async () => {
    const hero = await createHero(app, { name: "João Silva" });
    const controlHero = await createHero(app, { name: "Peter Parker" });

    const response = await app.inject({ method: "GET", url: "/heroes?q=joao" });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: Array<{ id: string }> }>();
    const ids = body.data.map((item) => item.id);
    expect(ids).toContain(hero.id);
    expect(ids).not.toContain(controlHero.id);
  });

  it("encontra herói pelo nickname buscando sem acento, e exclui quem não combina", async () => {
    const hero = await createHero(app, { nickname: "Capitão" });
    const controlHero = await createHero(app, { nickname: "Aranha" });

    const response = await app.inject({
      method: "GET",
      url: "/heroes?q=capitao",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: Array<{ id: string }> }>();
    const ids = body.data.map((item) => item.id);
    expect(ids).toContain(hero.id);
    expect(ids).not.toContain(controlHero.id);
  });

  it("trata % digitado na busca como texto literal, não como wildcard do LIKE", async () => {
    const heroWithPercent = await createHero(app, { nickname: "100% Herói" });
    await createHero(app, { nickname: "Herói Comum" });

    const response = await app.inject({
      method: "GET",
      url: `/heroes?q=${encodeURIComponent("100%")}`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: Array<{ id: string }> }>();
    const ids = body.data.map((item) => item.id);
    expect(ids).toEqual([heroWithPercent.id]);
  });

  it("percorre todas as páginas sem repetir nem pular heróis com o mesmo created_at", async () => {
    const sameCreatedAt = new Date("2024-05-01T10:00:00.000Z");
    const ids = Array.from({ length: 15 }, () => uuidv7()).sort();

    await testDatabase.db.insert(heroes).values(
      ids.map((id) => ({
        id,
        name: `Herói Colisão ${id}`,
        nickname: `Nick ${id}`,
        universe: "Universo de teste",
        main_power: "Força sobre-humana",
        date_of_birth: "1990-06-18",
        is_active: true,
        version: 1,
        created_at: sameCreatedAt,
        updated_at: sameCreatedAt,
      })),
    );

    const collectedIds: string[] = [];
    let cursor: string | null | undefined;
    let pageCount = 0;

    do {
      const url = cursor
        ? `/heroes?cursor=${encodeURIComponent(cursor)}`
        : "/heroes";
      const response = await app.inject({ method: "GET", url });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        data: Array<{ id: string }>;
        next_cursor: string | null;
      }>();

      collectedIds.push(...body.data.map((item) => item.id));
      cursor = body.next_cursor;
      pageCount += 1;
      expect(pageCount).toBeLessThanOrEqual(10);
    } while (cursor);

    expect(collectedIds).toHaveLength(15);
    expect(new Set(collectedIds).size).toBe(15);
    expect(new Set(collectedIds)).toEqual(new Set(ids));
  });

  it("não devolve next_cursor quando há menos de 10 heróis", async () => {
    for (let index = 0; index < 5; index += 1) {
      await createHero(app);
    }

    const response = await app.inject({ method: "GET", url: "/heroes" });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ next_cursor: string | null }>();
    expect(body.next_cursor).toBeNull();
  });
});
