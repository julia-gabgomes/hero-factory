import { sql } from "drizzle-orm";
import type { TestDatabase } from "./testcontainers.js";

export interface ColumnInfo {
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

export interface ForeignKeyRow {
  COLUMN_NAME: string;
  REFERENCED_TABLE_NAME: string | null;
  REFERENCED_COLUMN_NAME: string | null;
}

export async function getColumn(
  db: TestDatabase["db"],
  table: string,
  columnName: string,
): Promise<ColumnInfo> {
  const [rows] = await db.execute(
    sql`SELECT COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME, IS_NULLABLE, COLUMN_DEFAULT
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table} AND COLUMN_NAME = ${columnName}`,
  );
  const [column] = rows as unknown as ColumnInfo[];
  if (!column) {
    throw new Error(`Coluna ${columnName} não encontrada em ${table}`);
  }
  return column;
}

export async function getIndexes(
  db: TestDatabase["db"],
  table: string,
): Promise<Map<string, { columns: string[]; unique: boolean }>> {
  const [rows] = await db.execute(
    sql`SELECT INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME, NON_UNIQUE
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table}
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

export async function getPrimaryKeyColumns(
  db: TestDatabase["db"],
  table: string,
): Promise<string[]> {
  const [rows] = await db.execute(
    sql`SELECT COLUMN_NAME, SEQ_IN_INDEX
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table} AND INDEX_NAME = 'PRIMARY'
        ORDER BY SEQ_IN_INDEX`,
  );
  const indexRows = rows as unknown as { COLUMN_NAME: string; SEQ_IN_INDEX: number }[];
  return indexRows.map((row) => row.COLUMN_NAME);
}

export async function getForeignKeys(
  db: TestDatabase["db"],
  table: string,
): Promise<ForeignKeyRow[]> {
  const [rows] = await db.execute(
    sql`SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table}
          AND REFERENCED_TABLE_NAME IS NOT NULL`,
  );
  return rows as unknown as ForeignKeyRow[];
}
