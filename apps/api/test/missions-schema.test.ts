import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { missions } from "../src/db/schema/missions.js";
import { startTestDatabase, type TestDatabase } from "./testcontainers.js";

// Contrato assumido para esta etapa (ainda não implementado):
// - `apps/api/src/db/schema/missions.ts` exporta a tabela Drizzle `missions`.
//
// Os cenários C2, C4 e C5 pedem a definição do SQL gerado pela migration. Em
// vez de parsear o arquivo .sql, este teste consulta o `information_schema`
// do próprio MySQL real do Testcontainers (já com a migration aplicada) —
// mesmo padrão de `heroes-schema.test.ts`.

interface ColumnInfo {
  COLUMN_TYPE: string;
  CHARACTER_SET_NAME: string | null;
  COLLATION_NAME: string | null;
  IS_NULLABLE: "YES" | "NO";
  COLUMN_DEFAULT: string | null;
}

interface IndexColumnRow {
  INDEX_NAME: string;
  SEQ_IN_INDEX: number;
  COLUMN_NAME: string;
  NON_UNIQUE: number;
}

type MissionInsert = typeof missions.$inferInsert;

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

async function getColumn(db: TestDatabase["db"], columnName: string): Promise<ColumnInfo> {
  const [rows] = await db.execute(
    sql`SELECT COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME, IS_NULLABLE, COLUMN_DEFAULT
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'missions' AND COLUMN_NAME = ${columnName}`,
  );
  const [column] = rows as unknown as ColumnInfo[];
  if (!column) {
    throw new Error(`Coluna ${columnName} não encontrada em missions`);
  }
  return column;
}

async function getIndexes(db: TestDatabase["db"]): Promise<Map<string, { columns: string[]; unique: boolean }>> {
  const [rows] = await db.execute(
    sql`SELECT INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME, NON_UNIQUE
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'missions'
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

describe("schema de missions (MySQL real via Testcontainers)", () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await startTestDatabase();
  }, 120_000);

  afterAll(async () => {
    await testDatabase.stop();
  }, 60_000);

  // Etapa 02 · C1.a — Dado o banco limpo (via Testcontainers), quando se
  // aplicam as migrations em sequência (heroes, depois missions), então a
  // tabela `missions` passa a existir sem erro: uma missão válida pode ser
  // inserida e lida de volta pelo cliente Drizzle.
  it("existe e aceita inserir e ler uma missão válida", async () => {
    const row = buildMissionRow();

    await testDatabase.db.insert(missions).values(row);

    const found = await testDatabase.db.select().from(missions).where(sql`id = ${row.id}`);
    expect(found).toHaveLength(1);
    expect(found[0]!.title).toBe(row.title);
    expect(found[0]!.status).toBe("scheduled");
  });

  // Etapa 02 · C2.a — Dado o MySQL com a migration de `missions` aplicada,
  // quando se lê a definição da coluna `title`, então ela é VARCHAR(120) com
  // collation utf8mb4_0900_ai_ci.
  it("define missions.title como VARCHAR(120) com collation utf8mb4_0900_ai_ci", async () => {
    const column = await getColumn(testDatabase.db, "title");
    expect(column.COLUMN_TYPE).toBe("varchar(120)");
    expect(column.COLLATION_NAME).toBe("utf8mb4_0900_ai_ci");
  });

  // Etapa 02 · C3.a — Dado o banco com a migration aplicada, quando se tenta
  // inserir uma missão com `status = "pausada"` (valor fora dos 5 válidos),
  // então o banco rejeita a inserção.
  it("rejeita inserir uma missão com status inválido", async () => {
    const row = buildMissionRow();

    await expect(
      testDatabase.db.execute(
        sql`INSERT INTO missions (id, title, status, starts_at, ends_at, created_at, updated_at)
            VALUES (${row.id}, ${row.title}, 'pausada', ${row.starts_at}, ${row.ends_at}, ${row.created_at}, ${row.updated_at})`,
      ),
    ).rejects.toBeTruthy();
  });

  // Etapa 02 · C3.b — Dado o banco com a migration aplicada, quando se
  // insere uma missão com `status = "scheduled"`, então a inserção é
  // aceita e a missão passa a existir com essa situação.
  it("aceita inserir uma missão com status scheduled", async () => {
    const row = buildMissionRow({ status: "scheduled" });

    await testDatabase.db.insert(missions).values(row);

    const found = await testDatabase.db.select().from(missions).where(sql`id = ${row.id}`);
    expect(found).toHaveLength(1);
    expect(found[0]!.status).toBe("scheduled");
  });

  // Etapa 02 · C4.a — Dado o MySQL com a migration aplicada, quando se lê a
  // definição de `starts_at` e `ends_at`, então ambas são DATETIME(3).
  it.each(["starts_at", "ends_at"])("define missions.%s como DATETIME(3)", async (column) => {
    const info = await getColumn(testDatabase.db, column);
    expect(info.COLUMN_TYPE).toBe("datetime(3)");
  });

  // Etapa 02 · C5.a — Dado o MySQL com a migration aplicada, quando se lêem
  // os índices de `missions` no information_schema, então existe um índice
  // cobrindo exatamente as colunas `status`, `starts_at`, `ends_at`, nessa
  // ordem.
  it("tem um índice cobrindo (status, starts_at, ends_at) nessa ordem", async () => {
    const indexes = await getIndexes(testDatabase.db);
    const expectedOrder = ["status", "starts_at", "ends_at"];

    const matching = [...indexes.values()].find(
      (index) =>
        index.columns.length === expectedOrder.length &&
        index.columns.every((col, i) => col === expectedOrder[i]),
    );

    expect(matching).toBeDefined();
  });
});
