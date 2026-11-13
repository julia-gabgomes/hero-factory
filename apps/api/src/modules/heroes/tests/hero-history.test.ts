import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../../app.js";
import { heroes } from "../../../db/schema/heroes.js";
import { heroChanges } from "../../../db/schema/hero_changes.js";
import { idempotencyKeys } from "../../../db/schema/idempotency_keys.js";
import { startTestDatabase, type TestDatabase } from "../../../test-support/testcontainers.js";

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

type HeroChangeRow = {
  id: string;
  hero_id: string;
  event: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: Date;
};

type HistoryItem = {
  event: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
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

describe("Histórico de alterações de herói (MySQL real via Testcontainers)", () => {
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
    await testDatabase.db.delete(heroChanges);
    await testDatabase.db.delete(idempotencyKeys);
    await testDatabase.db.delete(heroes);
  });

  async function changesFor(heroId: string): Promise<HeroChangeRow[]> {
    return testDatabase.db
      .select()
      .from(heroChanges)
      .where(eq(heroChanges.hero_id, heroId));
  }

  it("grava uma linha por campo obrigatório ao criar, com event created e old_value null", async () => {
    const payload = validCreatePayload();
    const created = await createHero(app, payload);

    const rows = await changesFor(created.id);

    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.event === "created")).toBe(true);
    expect(rows.every((row) => row.old_value === null)).toBe(true);
    expect(rows.find((row) => row.field === "avatar_url")).toBeUndefined();

    const byField = new Map(rows.map((row) => [row.field, row.new_value]));
    expect(byField.get("name")).toBe(payload.name);
    expect(byField.get("nickname")).toBe(payload.nickname);
    expect(byField.get("universe")).toBe(payload.universe);
    expect(byField.get("main_power")).toBe(payload.main_power);
    expect(byField.get("date_of_birth")).toBe(payload.date_of_birth);
  });

  it("grava só a linha do campo alterado no PATCH, com old_value e new_value corretos", async () => {
    const created = await createHero(app);
    const previousNickname = created.nickname;

    const response = await app.inject({
      method: "PATCH",
      url: `/heroes/${created.id}`,
      payload: { nickname: "Nick Depois do Patch", version: 1 },
    });
    expect(response.statusCode).toBe(200);

    const rows = await changesFor(created.id);
    const updatedRows = rows.filter((row) => row.event === "updated");

    expect(updatedRows).toHaveLength(1);
    expect(updatedRows[0]?.field).toBe("nickname");
    expect(updatedRows[0]?.old_value).toBe(previousNickname);
    expect(updatedRows[0]?.new_value).toBe("Nick Depois do Patch");

    const updatedFields = updatedRows.map((row) => row.field);
    expect(updatedFields).not.toContain("name");
    expect(updatedFields).not.toContain("universe");
    expect(updatedFields).not.toContain("main_power");
    expect(updatedFields).not.toContain("date_of_birth");
  });

  it("grava uma linha com event deleted ao excluir o herói", async () => {
    const created = await createHero(app);

    const response = await app.inject({
      method: "DELETE",
      url: `/heroes/${created.id}`,
      payload: { version: 1 },
    });
    expect(response.statusCode).toBe(200);

    const rows = await changesFor(created.id);
    const deletedRows = rows.filter((row) => row.event === "deleted");

    expect(deletedRows).toHaveLength(1);
  });

  it("grava uma linha com field is_active e event inactivated ao inativar o herói", async () => {
    const created = await createHero(app);

    const response = await app.inject({
      method: "POST",
      url: `/heroes/${created.id}/deactivate`,
      payload: { version: 1 },
    });
    expect(response.statusCode).toBe(200);

    const rows = await changesFor(created.id);
    const inactivatedRows = rows.filter((row) => row.event === "inactivated");

    expect(inactivatedRows).toHaveLength(1);
    expect(inactivatedRows[0]?.field).toBe("is_active");
    expect(inactivatedRows[0]?.old_value).toBe("true");
    expect(inactivatedRows[0]?.new_value).toBe("false");
  });

  async function insertHistoryRow(params: {
    heroId: string;
    event: "created" | "updated" | "activated" | "inactivated" | "deleted";
    field: string;
    oldValue: string | null;
    newValue: string;
    createdAt: Date;
  }): Promise<void> {
    await testDatabase.db.insert(heroChanges).values({
      id: randomUUID(),
      hero_id: params.heroId,
      event: params.event,
      field: params.field,
      old_value: params.oldValue,
      new_value: params.newValue,
      created_at: params.createdAt,
    });
  }

  async function seedHistoryRows(heroId: string): Promise<void> {
    await insertHistoryRow({
      heroId,
      event: "updated",
      field: "name",
      oldValue: "antigo r1",
      newValue: "r1",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    });
    await insertHistoryRow({
      heroId,
      event: "updated",
      field: "nickname",
      oldValue: "antigo r2",
      newValue: "r2",
      createdAt: new Date("2024-01-01T02:00:00.000Z"),
    });
    await insertHistoryRow({
      heroId,
      event: "updated",
      field: "universe",
      oldValue: "antigo r3",
      newValue: "r3",
      createdAt: new Date("2024-01-01T04:00:00.000Z"),
    });
    await insertHistoryRow({
      heroId,
      event: "updated",
      field: "nickname",
      oldValue: "antigo r4",
      newValue: "r4",
      createdAt: new Date("2024-01-01T06:00:00.000Z"),
    });
  }

  it("lista o histórico paginado por cursor, mais recente primeiro", async () => {
    const created = await createHero(app);
    await seedHistoryRows(created.id);

    const response = await app.inject({
      method: "GET",
      url: `/heroes/${created.id}/history`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      data: HistoryItem[];
      next_cursor: string | null;
    }>();

    expect(body.data.map((item) => item.new_value)).toEqual([
      "r4",
      "r3",
      "r2",
      "r1",
    ]);
  });

  it("filtra o histórico por field", async () => {
    const created = await createHero(app);
    await seedHistoryRows(created.id);

    const response = await app.inject({
      method: "GET",
      url: `/heroes/${created.id}/history?field=nickname`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: HistoryItem[] }>();

    expect(body.data.every((item) => item.field === "nickname")).toBe(true);
    expect(body.data.map((item) => item.new_value)).toEqual(["r4", "r2"]);
  });

  it("filtra o histórico por período (from/to)", async () => {
    const created = await createHero(app);
    await seedHistoryRows(created.id);

    const response = await app.inject({
      method: "GET",
      url: `/heroes/${created.id}/history?from=${encodeURIComponent(
        "2024-01-01T01:00:00.000Z",
      )}&to=${encodeURIComponent("2024-01-01T05:00:00.000Z")}`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: HistoryItem[] }>();

    expect(body.data.map((item) => item.new_value)).toEqual(["r3", "r2"]);
  });

  it("pagina o histórico de 5 em 5", async () => {
    const created = await createHero(app);
    await seedHistoryRows(created.id);
    await insertHistoryRow({
      heroId: created.id,
      event: "updated",
      field: "main_power",
      oldValue: "antigo r5",
      newValue: "r5",
      createdAt: new Date("2024-01-01T08:00:00.000Z"),
    });
    await insertHistoryRow({
      heroId: created.id,
      event: "updated",
      field: "main_power",
      oldValue: "antigo r6",
      newValue: "r6",
      createdAt: new Date("2024-01-01T10:00:00.000Z"),
    });

    const firstPage = await app.inject({
      method: "GET",
      url: `/heroes/${created.id}/history`,
    });

    expect(firstPage.statusCode).toBe(200);
    const firstBody = firstPage.json<{
      data: HistoryItem[];
      next_cursor: string | null;
    }>();

    expect(firstBody.data).toHaveLength(5);
    expect(firstBody.data.map((item) => item.new_value)).toEqual([
      "r6",
      "r5",
      "r4",
      "r3",
      "r2",
    ]);
    expect(firstBody.next_cursor).not.toBeNull();

    const secondPage = await app.inject({
      method: "GET",
      url: `/heroes/${created.id}/history?cursor=${encodeURIComponent(
        firstBody.next_cursor ?? "",
      )}`,
    });

    expect(secondPage.statusCode).toBe(200);
    const secondBody = secondPage.json<{
      data: HistoryItem[];
      next_cursor: string | null;
    }>();

    expect(secondBody.data.map((item) => item.new_value)).toEqual(["r1"]);
    expect(secondBody.next_cursor).toBeNull();
  });

  it("retorna o total de alterações independente dos filtros aplicados", async () => {
    const created = await createHero(app);
    await seedHistoryRows(created.id);

    const response = await app.inject({
      method: "GET",
      url: `/heroes/${created.id}/history?field=nickname`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ total: number }>();

    expect(body.total).toBe(4);
  });

  it("retorna field_totals por campo, ignorando o filtro de campo da consulta", async () => {
    const created = await createHero(app);
    await seedHistoryRows(created.id);

    const response = await app.inject({
      method: "GET",
      url: `/heroes/${created.id}/history?field=nickname`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ field_totals: Record<string, number> }>();

    expect(body.field_totals).toEqual({
      name: 1,
      nickname: 2,
      universe: 1,
    });
  });

  it("restringe field_totals ao período informado", async () => {
    const created = await createHero(app);
    await seedHistoryRows(created.id);

    const response = await app.inject({
      method: "GET",
      url: `/heroes/${created.id}/history?from=${encodeURIComponent(
        "2024-01-01T01:00:00.000Z",
      )}&to=${encodeURIComponent("2024-01-01T05:00:00.000Z")}`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      total: number;
      field_totals: Record<string, number>;
    }>();

    expect(body.total).toBe(4);
    expect(body.field_totals).toEqual({
      nickname: 1,
      universe: 1,
    });
  });

  it("não grava linha órfã em hero_changes quando o PATCH falha por version desatualizada", async () => {
    const created = await createHero(app);

    const firstUpdate = await app.inject({
      method: "PATCH",
      url: `/heroes/${created.id}`,
      payload: { nickname: "Primeiro Nick", version: 1 },
    });
    expect(firstUpdate.statusCode).toBe(200);
    const afterFirstUpdate = firstUpdate.json<HeroBody>();
    expect(afterFirstUpdate.version).toBe(2);

    const rowsAfterFirstUpdate = await changesFor(created.id);
    const countAfterFirstUpdate = rowsAfterFirstUpdate.length;

    const staleUpdate = await app.inject({
      method: "PATCH",
      url: `/heroes/${created.id}`,
      payload: { nickname: "Segundo Nick", version: 1 },
    });
    expect(staleUpdate.statusCode).toBe(409);

    const rowsAfterStaleUpdate = await changesFor(created.id);
    expect(rowsAfterStaleUpdate).toHaveLength(countAfterFirstUpdate);
  });
});
