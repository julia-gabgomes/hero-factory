import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { heroes } from "../src/db/schema/heroes.js";
import { missionHeroes } from "../src/db/schema/mission_heroes.js";
import { missions } from "../src/db/schema/missions.js";
import { buildHeroRow, buildMissionRow } from "./factories.js";
import { getForeignKeys, getIndexes, getPrimaryKeyColumns } from "./information-schema.js";
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
    const pkColumns = await getPrimaryKeyColumns(testDatabase.db, "mission_heroes");
    expect(pkColumns).toEqual(["mission_id", "hero_id"]);
  });

  // Etapa 03 · C3.a — Dado o arquivo de migration SQL gerado, quando se lê a
  // definição da tabela `mission_heroes`, então existem constraints FOREIGN
  // KEY de `mission_id` para `missions.id` e de `hero_id` para `heroes.id`.
  it("tem FOREIGN KEY de mission_id -> missions.id e hero_id -> heroes.id", async () => {
    const foreignKeys = await getForeignKeys(testDatabase.db, "mission_heroes");

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
    const indexes = await getIndexes(testDatabase.db, "mission_heroes");

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
