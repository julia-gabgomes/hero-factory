import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { heroes } from "../../../src/db/schema/heroes.js";
import { idempotencyKeys } from "../../../src/db/schema/idempotency_keys.js";
import { startTestDatabase, type TestDatabase } from "../../testcontainers.js";

// Contrato assumido para esta etapa (ainda não implementado):
// - `POST /heroes/:id/activate` e `POST /heroes/:id/deactivate` existem,
//   exigem `version` no corpo e usam o mesmo lock otimista do PATCH/DELETE
//   (etapas 05/06): `UPDATE heroes SET is_active = :novoValor,
//   version = version + 1 WHERE id = :id AND version = :version
//   AND deleted_at IS NULL`.
//   Zero linhas afetadas distingue 404 NOT_FOUND (herói inexistente ou
//   excluído) de 409 VERSION_CONFLICT (herói existe, não excluído, mas a
//   version enviada está desatualizada), com `error.details.current`
//   contendo o estado atual nesse último caso. Quando a transição é
//   aplicada, a resposta de sucesso é 200 com o herói atualizado
//   (is_active no novo valor), consistente com o formato de sucesso do
//   PATCH/DELETE. O herói inativo continua visível em GET /heroes e
//   GET /heroes/:id.

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

  // Etapa 07 · C1.a — Dado um herói ativo com version = 1, quando se chama
  // `POST /heroes/:id/deactivate` com `{ version: 1 }`, então a resposta
  // indica sucesso e `GET /heroes/:id` mostra `is_active: false`.
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

  // Etapa 07 · C2.a — Dado um herói inativo com version = 2, quando se
  // chama `POST /heroes/:id/activate` com `{ version: 2 }`, então a
  // resposta indica sucesso e `GET /heroes/:id` mostra `is_active: true`.
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

  // Etapa 07 · C3.a — Dado um herói inativo, quando se chama
  // `GET /heroes`, então ele aparece na lista; quando se chama
  // `GET /heroes/:id`, então a resposta é 200 (não 404).
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

  // Etapa 07 · C4.a — Dado um id que nunca foi usado, quando se chama
  // `POST /heroes/:id/deactivate` (e, separadamente, `/activate`) com um
  // corpo válido, então a resposta é 404 com error.code = "NOT_FOUND".
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

  // Etapa 07 · C5.a — Dado um herói excluído, quando se chama
  // `POST /heroes/:id/activate` com a version certa, então a resposta é
  // 404 com error.code = "NOT_FOUND", mesmo com a version certa.
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

  // Etapa 07 · C6.a — Dado um herói ativo com version = 2, quando se chama
  // `POST /heroes/:id/deactivate` com version: 1 (desatualizada), então a
  // resposta é 409 com error.code = "VERSION_CONFLICT" e
  // error.details.current com o estado atual (version: 2).
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
