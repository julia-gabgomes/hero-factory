import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { heroes } from "../src/db/schema/heroes.js";
import { startTestDatabase, type TestDatabase } from "./testcontainers.js";

// Contrato assumido para esta etapa (ainda não implementado):
// - `apps/api/src/db/schema/heroes.ts` exporta a tabela Drizzle `heroes`.
// - `apps/api/test/testcontainers.ts` exporta `startTestDatabase()`, que sobe
//   um MySQL 8.4 real via Testcontainers, aplica as migrations geradas por
//   `pnpm db:generate`/`db:migrate` e devolve `{ db, stop }`: `db` é o
//   cliente Drizzle (mysql2) conectado a esse banco, e `stop()` encerra o
//   container. `stop()` é chamado uma vez em `afterAll`.
//
// Os cenários C2, C3, C4, C5 e C7 pedem a definição do SQL gerado pela
// migration. Em vez de parsear o arquivo .sql, este teste consulta o
// `information_schema` do próprio MySQL real do Testcontainers (já com a
// migration aplicada) — é mais robusto a diferenças de formatação do SQL
// gerado e já exercita a migration de verdade, em vez de só o texto dela.

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

type HeroInsert = typeof heroes.$inferInsert;

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

async function getColumn(db: TestDatabase["db"], columnName: string): Promise<ColumnInfo> {
  const [rows] = await db.execute(
    sql`SELECT COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME, IS_NULLABLE, COLUMN_DEFAULT
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'heroes' AND COLUMN_NAME = ${columnName}`,
  );
  const [column] = rows as unknown as ColumnInfo[];
  if (!column) {
    throw new Error(`Coluna ${columnName} não encontrada em heroes`);
  }
  return column;
}

async function getIndexes(db: TestDatabase["db"]): Promise<Map<string, { columns: string[]; unique: boolean }>> {
  const [rows] = await db.execute(
    sql`SELECT INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME, NON_UNIQUE
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'heroes'
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

describe("schema de heroes (MySQL real via Testcontainers)", () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await startTestDatabase();
  }, 120_000);

  afterAll(async () => {
    await testDatabase.stop();
  }, 60_000);

  // Etapa 01 · C8.a — Dado o helper de Testcontainers já com as migrations
  // aplicadas, quando se insere uma linha completa em `heroes` pelo cliente
  // Drizzle e em seguida se lê essa mesma linha pelo `id`, então a leitura
  // devolve exatamente os valores inseridos (textos, `date_of_birth` como
  // string "YYYY-MM-DD", `is_active`, `avatar_url` nulo e os timestamps).
  it("insere e lê de volta os mesmos valores em heroes", async () => {
    const row = buildHeroRow();

    await testDatabase.db.insert(heroes).values(row);

    const found = await testDatabase.db.select().from(heroes).where(eq(heroes.id, row.id));
    expect(found).toHaveLength(1);
    const read = found[0]!;

    expect(read.id).toBe(row.id);
    expect(read.name).toBe(row.name);
    expect(read.nickname).toBe(row.nickname);
    expect(read.universe).toBe(row.universe);
    expect(read.main_power).toBe(row.main_power);
    expect(read.date_of_birth).toBe("1990-06-18");
    expect(read.avatar_url).toBeNull();
    expect(read.is_active).toBe(true);
    expect(read.deleted_at).toBeNull();
    expect(new Date(read.created_at as string | number | Date).toISOString()).toBe(
      row.created_at.toISOString(),
    );
    expect(new Date(read.updated_at as string | number | Date).toISOString()).toBe(
      row.updated_at.toISOString(),
    );
  });

  // Etapa 01 · C6.a — Dado o banco com a migration aplicada, quando se
  // insere uma primeira linha ativa com `name`/`nickname`/`date_of_birth`
  // iguais a X e, em seguida, se tenta inserir uma segunda linha (outro
  // `id`) com o mesmo `name`/`nickname`/`date_of_birth` X, então o MySQL
  // rejeita a segunda inserção com erro de chave duplicada (ER_DUP_ENTRY),
  // provando o índice único `(name, nickname, date_of_birth)`.
  it("rejeita duas linhas com o mesmo name, nickname e date_of_birth", async () => {
    const shared = {
      name: `Duplicado ${randomUUID()}`,
      nickname: `Nick duplicado ${randomUUID()}`,
      date_of_birth: "1985-03-10",
    };
    const first = buildHeroRow(shared);
    const second = buildHeroRow(shared);

    await testDatabase.db.insert(heroes).values(first);

    await expect(testDatabase.db.insert(heroes).values(second)).rejects.toMatchObject({
      cause: { code: "ER_DUP_ENTRY" },
    });
  });

  // Etapa 01 · C9.a — Dado o banco com a migration aplicada, quando se
  // insere uma linha ativa (`deleted_at` nulo) com `name`/`nickname`/
  // `date_of_birth` iguais a X e, em seguida, se tenta inserir outra linha
  // com o mesmo X mas `deleted_at` preenchido, então essa segunda inserção
  // também é rejeitada por chave duplicada — o índice único vale mesmo para
  // linhas excluídas.
  it("rejeita a mesma combinação única mesmo quando a nova linha tem deleted_at preenchido", async () => {
    const shared = {
      name: `Excluído ${randomUUID()}`,
      nickname: `Nick excluído ${randomUUID()}`,
      date_of_birth: "1978-12-25",
    };
    const active = buildHeroRow(shared);
    const deleted = buildHeroRow({ ...shared, deleted_at: new Date("2024-01-01T00:00:00.000Z") });

    await testDatabase.db.insert(heroes).values(active);

    await expect(testDatabase.db.insert(heroes).values(deleted)).rejects.toMatchObject({
      cause: { code: "ER_DUP_ENTRY" },
    });
  });

  // Etapa 01 · C2.a — Dado o MySQL com a migration de `heroes` aplicada,
  // quando se lê a definição da coluna `id` no information_schema, então
  // ela é CHAR(36) com charset ascii e collation ascii_bin.
  it("define heroes.id como CHAR(36) CHARACTER SET ascii COLLATE ascii_bin", async () => {
    const column = await getColumn(testDatabase.db, "id");
    expect(column.COLUMN_TYPE).toBe("char(36)");
    expect(column.CHARACTER_SET_NAME).toBe("ascii");
    expect(column.COLLATION_NAME).toBe("ascii_bin");
  });

  // Etapa 01 · C3.a — Dado o MySQL com a migration aplicada, quando se lê a
  // definição de `name`, `nickname`, `universe`, `main_power` e
  // `avatar_url`, então cada uma é VARCHAR com o limite de
  // `packages/shared` (120, 60, 60, 80 e 2048, respectivamente), collation
  // utf8mb4_0900_ai_ci, e `avatar_url` é a única opcional (IS_NULLABLE=YES).
  it.each([
    { column: "name", length: 120 },
    { column: "nickname", length: 60 },
    { column: "universe", length: 60 },
    { column: "main_power", length: 80 },
    { column: "avatar_url", length: 2048 },
  ])("define heroes.$column como VARCHAR($length) com collation utf8mb4_0900_ai_ci", async ({ column, length }) => {
    const info = await getColumn(testDatabase.db, column);
    expect(info.COLUMN_TYPE).toBe(`varchar(${length})`);
    expect(info.COLLATION_NAME).toBe("utf8mb4_0900_ai_ci");
  });

  it("deixa heroes.avatar_url opcional", async () => {
    const info = await getColumn(testDatabase.db, "avatar_url");
    expect(info.IS_NULLABLE).toBe("YES");
  });

  // Etapa 01 · C4.a — Dado o MySQL com a migration aplicada, quando se lê a
  // definição de `date_of_birth`, então ela é DATE; quando se lê
  // `created_at` e `updated_at`, então ambas são DATETIME(3).
  it("define heroes.date_of_birth como DATE", async () => {
    const info = await getColumn(testDatabase.db, "date_of_birth");
    expect(info.COLUMN_TYPE).toBe("date");
  });

  it.each(["created_at", "updated_at"])("define heroes.%s como DATETIME(3)", async (column) => {
    const info = await getColumn(testDatabase.db, column);
    expect(info.COLUMN_TYPE).toBe("datetime(3)");
  });

  // Etapa 01 · C5.a — Dado o MySQL com a migration aplicada, quando se lê a
  // definição de `version`, então ela é INT NOT NULL com valor padrão 1.
  it("define heroes.version como INT NOT NULL DEFAULT 1", async () => {
    const info = await getColumn(testDatabase.db, "version");
    expect(info.COLUMN_TYPE).toBe("int");
    expect(info.IS_NULLABLE).toBe("NO");
    expect(info.COLUMN_DEFAULT).toBe("1");
  });

  // Etapa 01 · C7.a — Dado o MySQL com a migration aplicada, quando se lêem
  // os índices de `heroes` no information_schema, então existe um índice
  // (não necessariamente único) cobrindo exatamente as colunas
  // `deleted_at`, `created_at`, `id`, `name`, `nickname`, nessa ordem.
  it("tem um índice cobrindo (deleted_at, created_at, id, name, nickname) nessa ordem", async () => {
    const indexes = await getIndexes(testDatabase.db);
    const expectedOrder = ["deleted_at", "created_at", "id", "name", "nickname"];

    const matching = [...indexes.values()].find(
      (index) => index.columns.length === expectedOrder.length && index.columns.every((col, i) => col === expectedOrder[i]),
    );

    expect(matching).toBeDefined();
  });
});
