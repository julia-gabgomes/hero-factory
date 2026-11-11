import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { heroes } from "../../src/db/schema/heroes.js";
import { idempotencyKeys } from "../../src/db/schema/idempotency_keys.js";
import { startTestDatabase, type TestDatabase } from "../testcontainers.js";

const SERVER_TIMING_FORMAT = /^db;dur=\d+(\.\d+)?, total;dur=\d+(\.\d+)?$/;

describe("Server-Timing (MySQL real via Testcontainers)", () => {
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

  it("inclui Server-Timing com db;dur e total;dur numa resposta que acessa o banco", async () => {
    const response = await app.inject({ method: "GET", url: "/heroes" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["server-timing"]).toMatch(SERVER_TIMING_FORMAT);
  });

  it("inclui Server-Timing também numa resposta de erro", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/heroes/${randomUUID()}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers["server-timing"]).toMatch(SERVER_TIMING_FORMAT);
  });

  it("inclui Server-Timing numa criação que roda dentro de uma transação", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/heroes",
      headers: { "idempotency-key": randomUUID() },
      payload: {
        name: "Herói de Teste Server-Timing",
        nickname: `Nick ${randomUUID()}`,
        universe: "Universo de teste",
        main_power: "Força sobre-humana",
        date_of_birth: "1990-06-18",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers["server-timing"]).toMatch(SERVER_TIMING_FORMAT);
  });
});
