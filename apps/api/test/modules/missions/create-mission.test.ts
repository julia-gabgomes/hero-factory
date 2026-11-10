import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { idempotencyKeys } from "../../../src/db/schema/idempotency_keys.js";
import { missions } from "../../../src/db/schema/missions.js";
import { startTestDatabase, type TestDatabase } from "../../testcontainers.js";

type MissionBody = {
  id: string;
  title: string;
  status: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
};

function validCreatePayload(
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

describe("POST /missions (MySQL real via Testcontainers)", () => {
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
    await testDatabase.db.delete(missions);
  });

  it("devolve 400 BAD_REQUEST quando falta o header Idempotency-Key", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/missions",
      payload: validCreatePayload(),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { code: string } }>().error.code).toBe(
      "BAD_REQUEST",
    );
  });

  it("cria a missão agendada e devolve 201 com status scheduled", async () => {
    const payload = validCreatePayload();
    const response = await app.inject({
      method: "POST",
      url: "/missions",
      headers: { "idempotency-key": randomUUID() },
      payload,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json<MissionBody>();

    expect(body.id).toBeTruthy();
    expect(body.title).toBe(payload.title);
    expect(body.status).toBe("scheduled");
    expect(body.starts_at).toBe(payload.starts_at);
    expect(body.ends_at).toBe(payload.ends_at);
    expect(body.created_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/,
    );

    const rows = await testDatabase.db
      .select()
      .from(missions)
      .where(eq(missions.id, body.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("scheduled");
  });

  it("ignora id, status, created_at e updated_at enviados no corpo", async () => {
    const forgedId = randomUUID();
    const payload = validCreatePayload({
      id: forgedId,
      status: "in_progress",
      created_at: "2000-01-01T00:00:00.000Z",
      updated_at: "2000-01-01T00:00:00.000Z",
    });

    const response = await app.inject({
      method: "POST",
      url: "/missions",
      headers: { "idempotency-key": randomUUID() },
      payload,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json<MissionBody>();

    expect(body.id).not.toBe(forgedId);
    expect(body.status).toBe("scheduled");
  });

  it("devolve 422 VALIDATION_ERROR com fields.title quando o título tem só espaços", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/missions",
      headers: { "idempotency-key": randomUUID() },
      payload: validCreatePayload({ title: "   " }),
    });

    expect(response.statusCode).toBe(422);
    const body = response.json<{
      error: { code: string; fields: Record<string, string> | null };
    }>();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields?.title).toBeTruthy();
  });

  it("devolve 422 VALIDATION_ERROR com fields.ends_at quando ends_at não é depois de starts_at", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/missions",
      headers: { "idempotency-key": randomUUID() },
      payload: validCreatePayload({
        starts_at: "2024-05-01T12:00:00.000Z",
        ends_at: "2024-05-01T10:00:00.000Z",
      }),
    });

    expect(response.statusCode).toBe(422);
    const body = response.json<{
      error: { code: string; fields: Record<string, string> | null };
    }>();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields?.ends_at).toBeTruthy();
  });

  it("cria exatamente uma missão quando dois POSTs concorrentes usam a mesma Idempotency-Key e o mesmo corpo", async () => {
    const payload = validCreatePayload();
    const key = randomUUID();

    const [first, second] = await Promise.all([
      app.inject({
        method: "POST",
        url: "/missions",
        headers: { "idempotency-key": key },
        payload,
      }),
      app.inject({
        method: "POST",
        url: "/missions",
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
      .from(missions)
      .where(eq(missions.title, payload.title as string));
    expect(rows).toHaveLength(1);
  });

  it("devolve 422 IDEMPOTENCY_KEY_MISMATCH quando a mesma chave é reusada com corpo diferente", async () => {
    const key = randomUUID();

    const firstResponse = await app.inject({
      method: "POST",
      url: "/missions",
      headers: { "idempotency-key": key },
      payload: validCreatePayload(),
    });
    expect(firstResponse.statusCode).toBe(201);

    const secondResponse = await app.inject({
      method: "POST",
      url: "/missions",
      headers: { "idempotency-key": key },
      payload: validCreatePayload(),
    });

    expect(secondResponse.statusCode).toBe(422);
    expect(secondResponse.json<{ error: { code: string } }>().error.code).toBe(
      "IDEMPOTENCY_KEY_MISMATCH",
    );
  });
});
