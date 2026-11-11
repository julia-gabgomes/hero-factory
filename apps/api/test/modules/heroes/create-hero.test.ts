import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { heroes } from "../../../src/db/schema/heroes.js";
import { idempotencyKeys } from "../../../src/db/schema/idempotency_keys.js";
import { startTestDatabase, type TestDatabase } from "../../testcontainers.js";

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
