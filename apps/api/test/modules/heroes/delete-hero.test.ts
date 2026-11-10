import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { heroes } from "../../../src/db/schema/heroes.js";
import { idempotencyKeys } from "../../../src/db/schema/idempotency_keys.js";
import { startTestDatabase, type TestDatabase } from "../../testcontainers.js";

// Contrato assumido para esta etapa (ainda não implementado):
// - `DELETE /heroes/:id` existe, exige `version` no corpo e usa o mesmo
//   mecanismo de lock otimista do PATCH (etapa 05):
//   `UPDATE heroes SET deleted_at = NOW(3), version = version + 1
//    WHERE id = :id AND version = :version AND deleted_at IS NULL`.
//   Zero linhas afetadas distingue 404 NOT_FOUND (herói inexistente ou já
//   excluído) de 409 VERSION_CONFLICT (herói existe, ativo, mas a version
//   enviada está desatualizada), com `error.details.current` contendo o
//   estado atual nesse último caso. Quando a exclusão é aplicada, a
//   resposta de sucesso é 200 com o herói atualizado (deleted_at
//   preenchido), consistente com o formato de sucesso do PATCH.

type HeroBody = {
  id: string;
  name: string;
  nickname: string;
  universe: string;
  main_power: string;
  date_of_birth: string;
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

describe("DELETE /heroes/:id (MySQL real via Testcontainers)", () => {
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

  // Etapa 06 · C1.a — Dado um herói com version = 1, quando se chama
  // `DELETE /heroes/:id` com `{ version: 1 }`, então a resposta indica
  // sucesso (200) e, consultando o banco diretamente, `deleted_at` do
  // herói está preenchido (não é null).
  it("exclui o herói com a version correta e preenche deleted_at no banco", async () => {
    const created = await createHero(app);

    const response = await app.inject({
      method: "DELETE",
      url: `/heroes/${created.id}`,
      payload: { version: 1 },
    });

    expect(response.statusCode).toBe(200);

    const [row] = await testDatabase.db
      .select()
      .from(heroes)
      .where(eq(heroes.id, created.id));
    expect(row).toBeDefined();
    expect(row?.deleted_at).not.toBeNull();
  });

  // Etapa 06 · C2.a — Dado um herói excluído pela ação anterior, quando se
  // chama `GET /heroes/:id`, então a resposta é 404; quando se chama
  // `GET /heroes`, então esse herói não aparece na lista.
  it("some de GET /heroes/:id (404) e de GET /heroes (lista) depois de excluído", async () => {
    const created = await createHero(app);

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/heroes/${created.id}`,
      payload: { version: 1 },
    });
    expect(deleteResponse.statusCode).toBe(200);

    const getByIdResponse = await app.inject({
      method: "GET",
      url: `/heroes/${created.id}`,
    });
    expect(getByIdResponse.statusCode).toBe(404);
    const getByIdBody = getByIdResponse.json<{ error: { code: string } }>();
    expect(getByIdBody.error.code).toBe("NOT_FOUND");

    const listResponse = await app.inject({
      method: "GET",
      url: "/heroes",
    });
    expect(listResponse.statusCode).toBe(200);
    const listBody = listResponse.json<{ data: HeroBody[] }>();
    expect(listBody.data.some((hero) => hero.id === created.id)).toBe(false);
  });

  // Etapa 06 · C3.a — Dado um id que nunca foi usado, quando se chama
  // `DELETE /heroes/:id` com um corpo válido, então a resposta é 404 com
  // error.code = "NOT_FOUND".
  it("devolve 404 NOT_FOUND quando o id nunca existiu", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: `/heroes/${randomUUID()}`,
      payload: { version: 1 },
    });

    expect(response.statusCode).toBe(404);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  // Etapa 06 · C4.a — Dado um herói já excluído, quando se chama
  // `DELETE /heroes/:id` de novo com a version certa, então a resposta é
  // 404 com error.code = "NOT_FOUND", mesmo com a version certa.
  it("devolve 404 NOT_FOUND ao excluir de novo um herói já excluído, mesmo com a version certa", async () => {
    const created = await createHero(app);

    const firstDelete = await app.inject({
      method: "DELETE",
      url: `/heroes/${created.id}`,
      payload: { version: 1 },
    });
    expect(firstDelete.statusCode).toBe(200);
    const afterFirstDelete = firstDelete.json<HeroBody>();
    expect(afterFirstDelete.version).toBe(2);

    const secondDelete = await app.inject({
      method: "DELETE",
      url: `/heroes/${created.id}`,
      payload: { version: 2 },
    });

    expect(secondDelete.statusCode).toBe(404);
    const body = secondDelete.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  // Etapa 06 · C5.a — Dado um herói ativo com version = 2, quando se chama
  // `DELETE /heroes/:id` com version: 1 (desatualizada), então a resposta
  // é 409 com error.code = "VERSION_CONFLICT" e error.details.current com
  // o estado atual (incluindo version: 2 e deleted_at ainda null).
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

    const staleDelete = await app.inject({
      method: "DELETE",
      url: `/heroes/${created.id}`,
      payload: { version: 1 },
    });

    expect(staleDelete.statusCode).toBe(409);
    const body = staleDelete.json<{
      error: { code: string; details: { current: HeroBody } };
    }>();
    expect(body.error.code).toBe("VERSION_CONFLICT");
    expect(body.error.details.current.id).toBe(created.id);
    expect(body.error.details.current.version).toBe(2);
    expect(body.error.details.current.deleted_at).toBeNull();
  });
});
