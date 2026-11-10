import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { heroes } from "../../../src/db/schema/heroes.js";
import { idempotencyKeys } from "../../../src/db/schema/idempotency_keys.js";
import { startTestDatabase, type TestDatabase } from "../../testcontainers.js";

// Contrato assumido para esta etapa (ainda não implementado):
// - O índice único `(name, nickname, date_of_birth)` já existe no schema.
//   O repository de heróis ainda não traduz o erro de chave duplicada do
//   MySQL para `DUPLICATE_HERO` (409), nem na criação (`POST /heroes`) nem
//   na edição (`PATCH /heroes/:id`). Hoje esse erro provavelmente vira 500
//   `INTERNAL_ERROR` (erro não tratado).

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

describe("Herói repetido: DUPLICATE_HERO (MySQL real via Testcontainers)", () => {
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

  // Etapa 09 · C1.a — Dado um herói ativo com name = "Clark Kent",
  // nickname = "Super-Homem", date_of_birth = "1938-04-18", quando se
  // chama `POST /heroes` com esses mesmos três valores (os demais campos
  // podem variar), então a resposta é 409 com
  // `error.code = "DUPLICATE_HERO"`.
  it("devolve 409 DUPLICATE_HERO ao criar herói com name+nickname+date_of_birth iguais a um herói ativo", async () => {
    await createHero(app, {
      name: "Clark Kent",
      nickname: "Super-Homem",
      date_of_birth: "1938-04-18",
    });

    const response = await app.inject({
      method: "POST",
      url: "/heroes",
      headers: { "idempotency-key": randomUUID() },
      payload: validCreatePayload({
        name: "Clark Kent",
        nickname: "Super-Homem",
        date_of_birth: "1938-04-18",
        universe: "Outro universo",
        main_power: "Outro poder",
      }),
    });

    expect(response.statusCode).toBe(409);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("DUPLICATE_HERO");
  });

  // Etapa 09 · C2.a — Dado um herói excluído (inserido direto no banco com
  // deleted_at preenchido) com name/nickname/date_of_birth X, quando se
  // chama `POST /heroes` com os mesmos três valores X, então a resposta é
  // 409 com `error.code = "DUPLICATE_HERO"`.
  it("devolve 409 DUPLICATE_HERO ao criar herói com name+nickname+date_of_birth iguais a um herói excluído", async () => {
    const id = randomUUID();
    const now = new Date();
    await testDatabase.db.insert(heroes).values({
      id,
      name: "Bruce Wayne",
      nickname: "Batman",
      universe: "DC",
      main_power: "Intelecto",
      date_of_birth: "1939-03-30",
      is_active: true,
      deleted_at: now,
      version: 1,
      created_at: now,
      updated_at: now,
    });

    const response = await app.inject({
      method: "POST",
      url: "/heroes",
      headers: { "idempotency-key": randomUUID() },
      payload: validCreatePayload({
        name: "Bruce Wayne",
        nickname: "Batman",
        date_of_birth: "1939-03-30",
        universe: "Outro universo",
        main_power: "Outro poder",
      }),
    });

    expect(response.statusCode).toBe(409);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("DUPLICATE_HERO");
  });

  // Etapa 09 · C3.a — Dados dois heróis A e B distintos, quando se chama
  // `PATCH /heroes/:idB` alterando name/nickname/date_of_birth de B para os
  // mesmos valores de A, então a resposta é 409 com
  // `error.code = "DUPLICATE_HERO"`, e os dados de B não são alterados
  // (continuam com o name, nickname, date_of_birth e version originais).
  it("devolve 409 DUPLICATE_HERO ao editar um herói para colidir com outro, sem alterar o herói editado", async () => {
    const heroA = await createHero(app, {
      name: "Diana Prince",
      nickname: "Mulher-Maravilha",
      date_of_birth: "1941-10-21",
    });
    const heroB = await createHero(app, {
      name: "Barry Allen",
      nickname: "Flash",
      date_of_birth: "1956-01-01",
    });

    const response = await app.inject({
      method: "PATCH",
      url: `/heroes/${heroB.id}`,
      payload: {
        name: heroA.name,
        nickname: heroA.nickname,
        date_of_birth: heroA.date_of_birth,
        version: heroB.version,
      },
    });

    expect(response.statusCode).toBe(409);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("DUPLICATE_HERO");

    const getResponse = await app.inject({
      method: "GET",
      url: `/heroes/${heroB.id}`,
    });
    expect(getResponse.statusCode).toBe(200);
    const current = getResponse.json<HeroBody>();
    expect(current.name).toBe("Barry Allen");
    expect(current.nickname).toBe("Flash");
    expect(current.date_of_birth).toBe("1956-01-01");
    expect(current.version).toBe(heroB.version);
  });
});
