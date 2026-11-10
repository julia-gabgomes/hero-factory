import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { heroes } from "../../../src/db/schema/heroes.js";
import { idempotencyKeys } from "../../../src/db/schema/idempotency_keys.js";
import { startTestDatabase, type TestDatabase } from "../../testcontainers.js";

// Contrato assumido para esta etapa (ainda não implementado):
// - `GET /heroes/:id` existe, devolve 200 com os dados do herói quando ele
//   existe e não está excluído, e 404 `NOT_FOUND` quando o id não existe ou
//   quando o herói foi excluído (`deleted_at` preenchido).

function validCreatePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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

describe("GET /heroes/:id (MySQL real via Testcontainers)", () => {
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

  // Etapa 03 · C1.a — Dado um herói criado via `POST /heroes`, quando se
  // chama `GET /heroes/:id` com o id dele, então a resposta é 200 com os
  // mesmos dados do herói (mesmo id e mesmo name).
  it("devolve 200 com os dados do herói existente e não excluído", async () => {
    const payload = validCreatePayload();
    const createResponse = await app.inject({
      method: "POST",
      url: "/heroes",
      headers: { "idempotency-key": randomUUID() },
      payload,
    });
    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json<{ id: string; name: string }>();

    const getResponse = await app.inject({
      method: "GET",
      url: `/heroes/${created.id}`,
    });

    expect(getResponse.statusCode).toBe(200);
    const body = getResponse.json<{
      id: string;
      name: string;
      nickname: string;
      universe: string;
      main_power: string;
      date_of_birth: string;
    }>();

    expect(body.id).toBe(created.id);
    expect(body.name).toBe(payload.name);
    expect(body.nickname).toBe(payload.nickname);
    expect(body.universe).toBe(payload.universe);
    expect(body.main_power).toBe(payload.main_power);
    expect(body.date_of_birth).toBe(payload.date_of_birth);
  });

  // Etapa 03 · C2.a — Dado um id que nunca foi usado (UUID aleatório),
  // quando se chama `GET /heroes/:id`, então a resposta é 404 com
  // `error.code = "NOT_FOUND"`.
  it("devolve 404 NOT_FOUND quando o id nunca existiu", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/heroes/${randomUUID()}`,
    });

    expect(response.statusCode).toBe(404);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  // Etapa 03 · C3.a — Dado um herói inserido diretamente no banco com
  // `deleted_at` preenchido, quando se chama `GET /heroes/:id` com o id
  // dele, então a resposta é 404 com `error.code = "NOT_FOUND"`.
  it("devolve 404 NOT_FOUND quando o herói está excluído (deleted_at preenchido)", async () => {
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
      method: "GET",
      url: `/heroes/${id}`,
    });

    expect(response.statusCode).toBe(404);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
