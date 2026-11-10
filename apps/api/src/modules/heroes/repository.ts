import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { heroes } from "../../db/schema/heroes.js";
import type { Database } from "../../db/client.js";
import type { IdempotencyTransaction } from "../../http/idempotency.js";

export interface NewHeroRow {
  id: string;
  name: string;
  nickname: string;
  universe: string;
  main_power: string;
  date_of_birth: string;
  avatar_url: string | null;
  is_active: boolean;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export interface HeroResponse {
  id: string;
  name: string;
  nickname: string;
  universe: string;
  main_power: string;
  date_of_birth: string;
  avatar_url: string | null;
  is_active: boolean;
  deleted_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

interface HeroRow {
  id: string;
  name: string;
  nickname: string;
  universe: string;
  main_power: string;
  date_of_birth: string;
  avatar_url: string | null;
  is_active: boolean;
  deleted_at: Date | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

function mapRowToHeroResponse(row: HeroRow): HeroResponse {
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname,
    universe: row.universe,
    main_power: row.main_power,
    date_of_birth: row.date_of_birth,
    avatar_url: row.avatar_url,
    is_active: row.is_active,
    deleted_at: row.deleted_at === null ? null : row.deleted_at.toISOString(),
    version: row.version,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function findHeroById(db: Database, id: string): Promise<HeroResponse | null> {
  const [row] = await db.select().from(heroes).where(eq(heroes.id, id)).limit(1);

  if (!row) {
    return null;
  }

  return mapRowToHeroResponse(row);
}

const LIST_PAGE_SIZE = 10;

export async function listHeroes(db: Database): Promise<HeroResponse[]> {
  const rows = await db
    .select()
    .from(heroes)
    .where(isNull(heroes.deleted_at))
    .orderBy(desc(heroes.created_at), desc(heroes.id))
    .limit(LIST_PAGE_SIZE);

  return rows.map((row) => mapRowToHeroResponse(row));
}

export interface HeroUpdateFields {
  name?: string;
  nickname?: string;
  universe?: string;
  main_power?: string;
  date_of_birth?: string;
  avatar_url?: string | null;
}

export async function updateHeroWithOptimisticLock(
  db: Database,
  params: { id: string; version: number; fields: HeroUpdateFields },
): Promise<number> {
  const { id, version, fields } = params;

  const result = await db
    .update(heroes)
    .set({
      ...fields,
      version: sql`${heroes.version} + 1`,
      updated_at: new Date(),
    })
    .where(and(eq(heroes.id, id), eq(heroes.version, version), isNull(heroes.deleted_at)));

  return result[0].affectedRows;
}

export async function insertHero(
  tx: IdempotencyTransaction,
  row: NewHeroRow,
): Promise<HeroResponse> {
  await tx.insert(heroes).values(row);

  return mapRowToHeroResponse({ ...row, deleted_at: null });
}
