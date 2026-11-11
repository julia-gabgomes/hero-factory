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
  is_active: boolean;
  version: number;
  deleted_at: string | null;
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

describe("POST /heroes/:id/activate e /deactivate (MySQL real via Testcontainers)", () => {
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

  it("inativa o herói com a version correta e GET /heroes/:id reflete is_active: false", async () => {
    const created = await createHero(app);
    expect(created.is_active).toBe(true);

    const deactivateResponse = await app.inject({
      method: "POST",
      url: `/heroes/${created.id}/deactivate`,
      payload: { version: 1 },
    });
    expect(deactivateResponse.statusCode).toBe(200);

    const getResponse = await app.inject({
      method: "GET",
      url: `/heroes/${created.id}`,
    });
    expect(getResponse.statusCode).toBe(200);
    const body = getResponse.json<HeroBody>();
    expect(body.is_active).toBe(false);
  });

  it("ativa o herói com a version correta e GET /heroes/:id reflete is_active: true", async () => {
    const created = await createHero(app);

    const deactivateResponse = await app.inject({
      method: "POST",
      url: `/heroes/${created.id}/deactivate`,
      payload: { version: 1 },
    });
    expect(deactivateResponse.statusCode).toBe(200);
    const afterDeactivate = deactivateResponse.json<HeroBody>();
    expect(afterDeactivate.version).toBe(2);
    expect(afterDeactivate.is_active).toBe(false);

    const activateResponse = await app.inject({
      method: "POST",
      url: `/heroes/${created.id}/activate`,
      payload: { version: 2 },
    });
    expect(activateResponse.statusCode).toBe(200);

    const getResponse = await app.inject({
      method: "GET",
      url: `/heroes/${created.id}`,
    });
    expect(getResponse.statusCode).toBe(200);
    const body = getResponse.json<HeroBody>();
    expect(body.is_active).toBe(true);
  });

  it("mantém o herói inativo visível em GET /heroes e GET /heroes/:id", async () => {
    const created = await createHero(app);

    const deactivateResponse = await app.inject({
      method: "POST",
      url: `/heroes/${created.id}/deactivate`,
      payload: { version: 1 },
    });
    expect(deactivateResponse.statusCode).toBe(200);

    const getByIdResponse = await app.inject({
      method: "GET",
      url: `/heroes/${created.id}`,
    });
    expect(getByIdResponse.statusCode).toBe(200);

    const listResponse = await app.inject({
      method: "GET",
      url: "/heroes",
    });
    expect(listResponse.statusCode).toBe(200);
    const listBody = listResponse.json<{ data: HeroBody[] }>();
    const found = listBody.data.find((hero) => hero.id === created.id);
    expect(found).toBeDefined();
    expect(found?.is_active).toBe(false);
  });

  it("devolve 404 NOT_FOUND ao inativar um id que nunca existiu", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/heroes/${randomUUID()}/deactivate`,
      payload: { version: 1 },
    });

    expect(response.statusCode).toBe(404);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("devolve 404 NOT_FOUND ao ativar um id que nunca existiu", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/heroes/${randomUUID()}/activate`,
      payload: { version: 1 },
    });

    expect(response.statusCode).toBe(404);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("devolve 404 NOT_FOUND ao ativar um herói excluído, mesmo com a version certa", async () => {
    const created = await createHero(app);

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/heroes/${created.id}`,
      payload: { version: 1 },
    });
    expect(deleteResponse.statusCode).toBe(200);
    const afterDelete = deleteResponse.json<HeroBody>();
    expect(afterDelete.deleted_at).not.toBeNull();

    const activateResponse = await app.inject({
      method: "POST",
      url: `/heroes/${created.id}/activate`,
      payload: { version: afterDelete.version },
    });

    expect(activateResponse.statusCode).toBe(404);
    const body = activateResponse.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("devolve 409 VERSION_CONFLICT com details.current quando a version está desatualizada", async () => {
    const created = await createHero(app);

    const update = await app.inject({
      method: "PATCH",
      url: `/heroes/${created.id}`,
      payload: { nickname: "Nick Atualizado", version: 1 },
    });
    expect(update.statusCode).toBe(200);
    const afterUpdate = update.json<HeroBody>();
    expect(afterUpdate.version).toBe(2);

    const staleDeactivate = await app.inject({
      method: "POST",
      url: `/heroes/${created.id}/deactivate`,
      payload: { version: 1 },
    });

    expect(staleDeactivate.statusCode).toBe(409);
    const body = staleDeactivate.json<{
      error: { code: string; details: { current: HeroBody } };
    }>();
    expect(body.error.code).toBe("VERSION_CONFLICT");
    expect(body.error.details.current.id).toBe(created.id);
    expect(body.error.details.current.version).toBe(2);
    expect(body.error.details.current.is_active).toBe(true);
  });
});
