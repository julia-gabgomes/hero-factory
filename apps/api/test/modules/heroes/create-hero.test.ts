import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { heroes } from "../../../src/db/schema/heroes.js";
import { idempotencyKeys } from "../../../src/db/schema/idempotency_keys.js";
import { startTestDatabase, type TestDatabase } from "../../testcontainers.js";

// Contrato assumido para esta etapa (ainda não implementado):
// - `POST /heroes` existe, exige o header `Idempotency-Key` (UUID) em todo
//   pedido de criação, valida o corpo com `createHeroSchema` do
//   `@hero-factory/shared`, usa `withIdempotency` (etapa 01) com o escopo
//   da criação de herói, e grava o herói com `id` gerado pelo servidor,
//   `version = 1`, `is_active = true`, `deleted_at = null` e
//   `created_at`/`updated_at` em ISO 8601 UTC.

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

describe("POST /heroes (MySQL real via Testcontainers)", () => {
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

  // Etapa 02 · C1.a — Dado um corpo válido de criação, quando se chama
  // `POST /heroes` sem o header `Idempotency-Key`, então a resposta é 400
  // com `error.code = "BAD_REQUEST"`.
  it("devolve 400 BAD_REQUEST quando falta o header Idempotency-Key", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/heroes",
      payload: validCreatePayload(),
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  // Etapa 02 · C2.a — Dado um corpo válido com todos os campos obrigatórios
  // e um `Idempotency-Key` novo, quando se chama `POST /heroes`, então a
  // resposta é 201, o herói criado tem `version = 1`, `is_active = true`, e
  // `created_at`/`updated_at` no formato ISO 8601 UTC.
  it("cria o herói e devolve 201 com version 1, is_active true e timestamps ISO 8601 UTC", async () => {
    const payload = validCreatePayload();
    const response = await app.inject({
      method: "POST",
      url: "/heroes",
      headers: { "idempotency-key": randomUUID() },
      payload,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json<{
      id: string;
      version: number;
      is_active: boolean;
      created_at: string;
      updated_at: string;
      name: string;
    }>();

    expect(body.id).toBeTruthy();
    expect(body.version).toBe(1);
    expect(body.is_active).toBe(true);
    expect(body.name).toBe(payload.name);
    expect(body.created_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/,
    );
    expect(body.updated_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/,
    );

    const rows = await testDatabase.db
      .select()
      .from(heroes)
      .where(eq(heroes.id, body.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.version).toBe(1);
    expect(rows[0]?.is_active).toBe(true);
  });

  // Etapa 02 · C3.a — Dado um corpo válido e uma `Idempotency-Key` X,
  // quando se disparam dois `POST /heroes` concorrentes com X e o mesmo
  // corpo (barreira), então existe exatamente um herói no banco com os
  // dados desse corpo, e uma das duas respostas tem
  // `Idempotent-Replayed: true`.
  it("cria exatamente um herói quando dois POSTs concorrentes usam a mesma Idempotency-Key e o mesmo corpo", async () => {
    const payload = validCreatePayload();
    const key = randomUUID();

    const [first, second] = await Promise.all([
      app.inject({
        method: "POST",
        url: "/heroes",
        headers: { "idempotency-key": key },
        payload,
      }),
      app.inject({
        method: "POST",
        url: "/heroes",
        headers: { "idempotency-key": key },
        payload,
      }),
    ]);

    expect([first.statusCode, second.statusCode].sort()).toEqual([201, 201]);

    const replayedFlags = [
      first.headers["idempotent-replayed"],
      second.headers["idempotent-replayed"],
    ];
    expect(replayedFlags.filter((flag) => flag === "true")).toHaveLength(1);

    const rows = await testDatabase.db
      .select()
      .from(heroes)
      .where(eq(heroes.name, payload.name as string));
    expect(rows).toHaveLength(1);
  });

  // Etapa 02 · C4.a — Dado um `POST /heroes` já respondido com a
  // `Idempotency-Key` X, quando se chama `POST /heroes` de novo com X mas
  // um corpo diferente, então a resposta é 422 com
  // `error.code = "IDEMPOTENCY_KEY_MISMATCH"`.
  it("devolve 422 IDEMPOTENCY_KEY_MISMATCH quando a mesma chave é reusada com corpo diferente", async () => {
    const key = randomUUID();

    const firstResponse = await app.inject({
      method: "POST",
      url: "/heroes",
      headers: { "idempotency-key": key },
      payload: validCreatePayload(),
    });
    expect(firstResponse.statusCode).toBe(201);

    const secondResponse = await app.inject({
      method: "POST",
      url: "/heroes",
      headers: { "idempotency-key": key },
      payload: validCreatePayload(),
    });

    expect(secondResponse.statusCode).toBe(422);
    const body = secondResponse.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("IDEMPOTENCY_KEY_MISMATCH");
  });

  // Etapa 02 · C5.a — Dado um corpo de criação com `id`, `created_at`,
  // `updated_at`, `version` e `deleted_at` preenchidos arbitrariamente,
  // quando se chama `POST /heroes`, então o herói criado ignora esses
  // valores (novo `id` gerado pelo servidor, `version = 1`, `deleted_at`
  // nulo).
  it("ignora id, created_at, updated_at, version e deleted_at enviados no corpo", async () => {
    const forgedId = randomUUID();
    const payload = validCreatePayload({
      id: forgedId,
      created_at: "2000-01-01T00:00:00.000Z",
      updated_at: "2000-01-01T00:00:00.000Z",
      version: 99,
      deleted_at: "2000-01-01T00:00:00.000Z",
    });

    const response = await app.inject({
      method: "POST",
      url: "/heroes",
      headers: { "idempotency-key": randomUUID() },
      payload,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json<{
      id: string;
      version: number;
      deleted_at: string | null | undefined;
    }>();

    expect(body.id).not.toBe(forgedId);
    expect(body.version).toBe(1);
    expect(body.deleted_at ?? null).toBeNull();

    const rows = await testDatabase.db
      .select()
      .from(heroes)
      .where(eq(heroes.id, body.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.version).toBe(1);
    expect(rows[0]?.deleted_at).toBeNull();
  });

  // Etapa 02 · C6.a — Dado um corpo com `nickname = "   "` (só espaços),
  // quando se chama `POST /heroes`, então a resposta é 422 com
  // `fields.nickname` preenchido.
  it("devolve 422 VALIDATION_ERROR com fields.nickname quando nickname tem só espaços", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/heroes",
      headers: { "idempotency-key": randomUUID() },
      payload: validCreatePayload({ nickname: "   " }),
    });

    expect(response.statusCode).toBe(422);
    const body = response.json<{
      error: { code: string; fields: Record<string, string> | null };
    }>();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields?.nickname).toBeTruthy();
  });

  // Etapa 02 · C7.a — Dado um corpo com `date_of_birth` igual a uma data
  // futura (UTC+14), quando se chama `POST /heroes`, então a resposta é
  // 422 com `fields.date_of_birth` preenchido.
  it("devolve 422 VALIDATION_ERROR com fields.date_of_birth quando a data de nascimento é futura", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/heroes",
      headers: { "idempotency-key": randomUUID() },
      payload: validCreatePayload({ date_of_birth: "9999-01-01" }),
    });

    expect(response.statusCode).toBe(422);
    const body = response.json<{
      error: { code: string; fields: Record<string, string> | null };
    }>();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields?.date_of_birth).toBeTruthy();
  });
});
