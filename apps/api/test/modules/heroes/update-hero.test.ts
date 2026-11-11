import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { heroes } from "../../../src/db/schema/heroes.js";
import { idempotencyKeys } from "../../../src/db/schema/idempotency_keys.js";
import { startTestDatabase, type TestDatabase } from "../../testcontainers.js";

type HeroBody = {
  id: string;
  name: string;
  nickname: string;
  universe: string;
  main_power: string;
  date_of_birth: string;
  version: number;
  updated_at: string;
};

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
): Promise<HeroBody> {
  const payload = validCreatePayload(overrides);
  const response = await app.inject({
    method: "POST",
    url: "/heroes",
    headers: { "idempotency-key": randomUUID() },
    payload,
  });
  expect(response.statusCode).toBe(201);
  return response.json<HeroBody>();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("PATCH /heroes/:id (MySQL real via Testcontainers)", () => {
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

  it("aplica só o campo enviado, incrementa a version e atualiza updated_at", async () => {
    const created = await createHero(app);
    await wait(20);

    const response = await app.inject({
      method: "PATCH",
      url: `/heroes/${created.id}`,
      payload: { nickname: "Novo Nick", version: 1 },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<HeroBody>();

    expect(body.nickname).toBe("Novo Nick");
    expect(body.name).toBe(created.name);
    expect(body.universe).toBe(created.universe);
    expect(body.main_power).toBe(created.main_power);
    expect(body.date_of_birth).toBe(created.date_of_birth);
    expect(body.version).toBe(2);
    expect(new Date(body.updated_at).getTime()).toBeGreaterThan(
      new Date(created.updated_at).getTime(),
    );
  });

  it("devolve 404 NOT_FOUND quando o id nunca existiu", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/heroes/${randomUUID()}`,
      payload: { nickname: "Novo Nick", version: 1 },
    });

    expect(response.statusCode).toBe(404);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("devolve 404 NOT_FOUND quando o herói está excluído, mesmo com a version correta", async () => {
    const id = randomUUID();
    const now = new Date();
    await testDatabase.db.insert(heroes).values({
      id,
      name: `Herói Excluído ${id}`,
      nickname: `Nick ${id}`,
      universe: "Universo de teste",
      main_power: "Força sobre-humana",
      date_of_birth: "1990-06-18",
      is_active: true,
      deleted_at: now,
      version: 1,
      created_at: now,
      updated_at: now,
    });

    const response = await app.inject({
      method: "PATCH",
      url: `/heroes/${id}`,
      payload: { nickname: "Novo Nick", version: 1 },
    });

    expect(response.statusCode).toBe(404);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("devolve 409 VERSION_CONFLICT com details.current quando a version está desatualizada", async () => {
    const created = await createHero(app);

    const firstUpdate = await app.inject({
      method: "PATCH",
      url: `/heroes/${created.id}`,
      payload: { nickname: "Primeiro Nick", version: 1 },
    });
    expect(firstUpdate.statusCode).toBe(200);
    const afterFirstUpdate = firstUpdate.json<HeroBody>();
    expect(afterFirstUpdate.version).toBe(2);

    const staleUpdate = await app.inject({
      method: "PATCH",
      url: `/heroes/${created.id}`,
      payload: { nickname: "Segundo Nick", version: 1 },
    });

    expect(staleUpdate.statusCode).toBe(409);
    const body = staleUpdate.json<{
      error: { code: string; details: { current: HeroBody } };
    }>();
    expect(body.error.code).toBe("VERSION_CONFLICT");
    expect(body.error.details.current.version).toBe(2);
    expect(body.error.details.current.id).toBe(created.id);
    expect(body.error.details.current.nickname).toBe("Primeiro Nick");
  });

  it("resolve dois PATCHes concorrentes com a mesma version em exatamente um 200 e um 409", async () => {
    const created = await createHero(app);

    const [first, second] = await Promise.all([
      app.inject({
        method: "PATCH",
        url: `/heroes/${created.id}`,
        payload: { nickname: "Nick Concorrente A", version: 1 },
      }),
      app.inject({
        method: "PATCH",
        url: `/heroes/${created.id}`,
        payload: { nickname: "Nick Concorrente B", version: 1 },
      }),
    ]);

    const statusCodes = [first.statusCode, second.statusCode].sort(
      (a, b) => a - b,
    );
    expect(statusCodes).toEqual([200, 409]);

    const winner = first.statusCode === 200 ? first : second;
    const loser = first.statusCode === 200 ? second : first;

    const winnerBody = winner.json<HeroBody>();
    expect(winnerBody.version).toBe(2);

    const loserBody = loser.json<{ error: { code: string } }>();
    expect(loserBody.error.code).toBe("VERSION_CONFLICT");
  });
});
