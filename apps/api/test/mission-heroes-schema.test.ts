import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { heroes } from "../src/db/schema/heroes.js";
import { missionHeroes } from "../src/db/schema/mission_heroes.js";
import { missions } from "../src/db/schema/missions.js";
import { startTestDatabase, type TestDatabase } from "./testcontainers.js";

// Contrato assumido para esta etapa (ainda não implementado):
// - `apps/api/src/db/schema/mission_heroes.ts` exporta a tabela Drizzle
//   `missionHeroes`, mapeada para a tabela `mission_heroes`, com PK composta
//   `(mission_id, hero_id)`, FKs para `missions.id` e `heroes.id`, e um
//   índice cobrindo `(hero_id)`.
//
// Os cenários C2, C3.a e C4 pedem a definição do SQL gerado pela migration.
// Em vez de parsear o arquivo .sql, este teste consulta o
// `information_schema` do próprio MySQL real do Testcontainers (já com as
// três migrations aplicadas) — mesmo padrão de `heroes-schema.test.ts` e
// `missions-schema.test.ts`.

interface IndexColumnRow {
  INDEX_NAME: string;
  SEQ_IN_INDEX: number;
  COLUMN_NAME: string;
  NON_UNIQUE: number;
}

interface ForeignKeyRow {
  COLUMN_NAME: string;
  REFERENCED_TABLE_NAME: string | null;
  REFERENCED_COLUMN_NAME: string | null;
}

type MissionInsert = typeof missions.$inferInsert;
type HeroInsert = typeof heroes.$inferInsert;

function buildMissionRow(overrides: Partial<MissionInsert> = {}): MissionInsert {
  const startsAt = new Date("2024-05-01T10:00:00.000Z");
  const endsAt = new Date("2024-05-01T12:00:00.000Z");
  const now = new Date("2024-05-01T09:00:00.000Z");
  return {
    id: randomUUID(),
    title: `Missão de teste ${randomUUID()}`,
    status: "scheduled",
    starts_at: startsAt,
    ends_at: endsAt,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function buildHeroRow(overrides: Partial<HeroInsert> = {}): HeroInsert {
  const now = new Date("2024-05-01T10:00:00.000Z");
  const suffix = randomUUID();
  return {
    id: randomUUID(),
    name: `Teste Herói ${suffix}`,
    nickname: `Nick ${suffix}`,
    universe: "Universo de teste",
    main_power: "Poder de teste",
    date_of_birth: "1990-06-18",
    avatar_url: null,
    is_active: true,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

async function getIndexes(db: TestDatabase["db"]): Promise<Map<string, { columns: string[]; unique: boolean }>> {
  const [rows] = await db.execute(
    sql`SELECT INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME, NON_UNIQUE
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mission_heroes'
        ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
  );
  const indexRows = rows as unknown as IndexColumnRow[];
  const indexes = new Map<string, { columns: string[]; unique: boolean }>();
  for (const row of indexRows) {
    const existing = indexes.get(row.INDEX_NAME);
    if (existing) {
      existing.columns.push(row.COLUMN_NAME);
    } else {
      indexes.set(row.INDEX_NAME, { columns: [row.COLUMN_NAME], unique: row.NON_UNIQUE === 0 });
    }
  }
  return indexes;
}

async function getForeignKeys(db: TestDatabase["db"]): Promise<ForeignKeyRow[]> {
  const [rows] = await db.execute(
    sql`SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mission_heroes'
          AND REFERENCED_TABLE_NAME IS NOT NULL`,
  );
  return rows as unknown as ForeignKeyRow[];
}

describe("schema de mission_heroes (MySQL real via Testcontainers)", () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await startTestDatabase();
  }, 120_000);

  afterAll(async () => {
    await testDatabase.stop();
  }, 60_000);

  // Etapa 03 · C1.a — Dado o banco limpo (via Testcontainers), quando se
  // aplicam as migrations em sequência (heroes, missions, mission_heroes),
  // então a tabela `mission_heroes` passa a existir sem erro: uma escalação
  // válida (missão e herói reais) pode ser inserida e lida de volta pelo
  // cliente Drizzle.
  it("existe e aceita inserir e ler uma escalação válida", async () => {
    const mission = buildMissionRow();
    const hero = buildHeroRow();
    await testDatabase.db.insert(missions).values(mission);
    await testDatabase.db.insert(heroes).values(hero);

    await testDatabase.db.insert(missionHeroes).values({ mission_id: mission.id, hero_id: hero.id });

    const found = await testDatabase.db
      .select()
      .from(missionHeroes)
      .where(sql`mission_id = ${mission.id} AND hero_id = ${hero.id}`);
    expect(found).toHaveLength(1);
    expect(found[0]!.mission_id).toBe(mission.id);
    expect(found[0]!.hero_id).toBe(hero.id);
  });

  // Etapa 03 · C2.a — Dado o arquivo de migration SQL gerado (verificado via
  // information_schema do banco já migrado), quando se lê a PK da tabela
  // `mission_heroes`, então ela é composta por exatamente `(mission_id,
  // hero_id)`, nessa ordem.
  it("tem a PK composta por (mission_id, hero_id)", async () => {
    const [rows] = await testDatabase.db.execute(
      sql`SELECT COLUMN_NAME, SEQ_IN_INDEX
          FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mission_heroes' AND INDEX_NAME = 'PRIMARY'
          ORDER BY SEQ_IN_INDEX`,
    );
    const pkRows = rows as unknown as { COLUMN_NAME: string; SEQ_IN_INDEX: number }[];
    expect(pkRows.map((r) => r.COLUMN_NAME)).toEqual(["mission_id", "hero_id"]);
  });

  // Etapa 03 · C3.a — Dado o arquivo de migration SQL gerado, quando se lê a
  // definição da tabela `mission_heroes`, então existem constraints FOREIGN
  // KEY de `mission_id` para `missions.id` e de `hero_id` para `heroes.id`.
  it("tem FOREIGN KEY de mission_id -> missions.id e hero_id -> heroes.id", async () => {
    const foreignKeys = await getForeignKeys(testDatabase.db);

    expect(
      foreignKeys.some(
        (fk) => fk.COLUMN_NAME === "mission_id" && fk.REFERENCED_TABLE_NAME === "missions" && fk.REFERENCED_COLUMN_NAME === "id",
      ),
    ).toBe(true);
    expect(
      foreignKeys.some(
        (fk) => fk.COLUMN_NAME === "hero_id" && fk.REFERENCED_TABLE_NAME === "heroes" && fk.REFERENCED_COLUMN_NAME === "id",
      ),
    ).toBe(true);
  });

  // Etapa 03 · C3.b — Dado o banco com as três migrations aplicadas, quando
  // se insere uma linha em `mission_heroes` com um `hero_id` aleatório que
  // não existe em `heroes` (mas com uma missão real), então o banco rejeita
  // por violação de chave estrangeira.
  it("rejeita inserir com hero_id inexistente", async () => {
    const mission = buildMissionRow();
    await testDatabase.db.insert(missions).values(mission);

    await expect(
      testDatabase.db.insert(missionHeroes).values({ mission_id: mission.id, hero_id: randomUUID() }),
    ).rejects.toBeTruthy();
  });

  // Etapa 03 · C3.b — Mesma regra, agora com um `mission_id` aleatório que
  // não existe em `missions` (mas com um herói real): a inserção também é
  // rejeitada por violação de chave estrangeira.
  it("rejeita inserir com mission_id inexistente", async () => {
    const hero = buildHeroRow();
    await testDatabase.db.insert(heroes).values(hero);

    await expect(
      testDatabase.db.insert(missionHeroes).values({ mission_id: randomUUID(), hero_id: hero.id }),
    ).rejects.toBeTruthy();
  });

  // Etapa 03 · C4.a — Dado o arquivo de migration SQL gerado, quando se lêem
  // os índices da tabela `mission_heroes`, então existe um índice cobrindo
  // a coluna `hero_id` (além da PK).
  it("tem um índice cobrindo (hero_id)", async () => {
    const indexes = await getIndexes(testDatabase.db);

    const matching = [...indexes.entries()].find(
      ([name, index]) => name !== "PRIMARY" && index.columns.length === 1 && index.columns[0] === "hero_id",
    );

    expect(matching).toBeDefined();
  });

  // Etapa 03 · C5.a — Dado uma missão e um herói já escalados (uma linha em
  // `mission_heroes` com esse par), quando se tenta inserir novamente a
  // mesma combinação `(mission_id, hero_id)`, então o banco rejeita por
  // chave duplicada (PK composta).
  it("rejeita escalar o mesmo herói duas vezes na mesma missão", async () => {
    const mission = buildMissionRow();
    const hero = buildHeroRow();
    await testDatabase.db.insert(missions).values(mission);
    await testDatabase.db.insert(heroes).values(hero);

    await testDatabase.db.insert(missionHeroes).values({ mission_id: mission.id, hero_id: hero.id });

    await expect(
      testDatabase.db.insert(missionHeroes).values({ mission_id: mission.id, hero_id: hero.id }),
    ).rejects.toMatchObject({
      cause: { code: "ER_DUP_ENTRY" },
    });
  });
});
