import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { heroes } from "../../db/schema/heroes.js";
import type { Database } from "../../db/client.js";
import { isDuplicateEntryError } from "../../db/mysql-errors.js";
import type { IdempotencyTransaction } from "../../http/idempotency.js";
import { duplicateHero } from "../../http/errors.js";
import type { HeroListCursor } from "../../http/cursor.js";

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

export async function findHeroById(
  db: Database,
  id: string,
): Promise<HeroResponse | null> {
  const [row] = await db
    .select()
    .from(heroes)
    .where(eq(heroes.id, id))
    .limit(1);

  if (!row) {
    return null;
  }

  return mapRowToHeroResponse(row);
}

export const LIST_PAGE_SIZE = 10;

export function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export interface ListHeroesParams {
  q?: string;
  cursor?: HeroListCursor;
  limit?: number;
}

export async function listHeroes(
  db: Database,
  params: ListHeroesParams = {},
): Promise<HeroResponse[]> {
  const { q, cursor, limit = LIST_PAGE_SIZE } = params;

  const conditions = [isNull(heroes.deleted_at)];

  if (q !== undefined && q !== "") {
    const pattern = `%${escapeLikeTerm(q)}%`;
    const searchCondition = or(
      sql`${heroes.name} LIKE ${pattern}`,
      sql`${heroes.nickname} LIKE ${pattern}`,
    );

    if (searchCondition !== undefined) {
      conditions.push(searchCondition);
    }
  }

  if (cursor !== undefined) {
    conditions.push(
      sql`(${heroes.created_at}, ${heroes.id}) < (${new Date(cursor.created_at)}, ${cursor.id})`,
    );
  }

  const rows = await db
    .select()
    .from(heroes)
    .where(and(...conditions))
    .orderBy(desc(heroes.created_at), desc(heroes.id))
    .limit(limit);

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

  try {
    const result = await db
      .update(heroes)
      .set({
        ...fields,
        version: sql`${heroes.version} + 1`,
        updated_at: new Date(),
      })
      .where(
        and(
          eq(heroes.id, id),
          eq(heroes.version, version),
          isNull(heroes.deleted_at),
        ),
      );

    return result[0].affectedRows;
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      throw duplicateHero(
        "Já existe um herói com o mesmo nome, nome de guerra e data de nascimento.",
      );
    }
    throw error;
  }
}

export async function deleteHeroWithOptimisticLock(
  db: Database,
  params: { id: string; version: number },
): Promise<number> {
  const { id, version } = params;

  const result = await db
    .update(heroes)
    .set({
      deleted_at: new Date(),
      version: sql`${heroes.version} + 1`,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(heroes.id, id),
        eq(heroes.version, version),
        isNull(heroes.deleted_at),
      ),
    );

  return result[0].affectedRows;
}

export async function setHeroActiveStateWithOptimisticLock(
  db: Database,
  params: { id: string; version: number; isActive: boolean },
): Promise<number> {
  const { id, version, isActive } = params;

  const result = await db
    .update(heroes)
    .set({
      is_active: isActive,
      version: sql`${heroes.version} + 1`,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(heroes.id, id),
        eq(heroes.version, version),
        isNull(heroes.deleted_at),
      ),
    );

  return result[0].affectedRows;
}

export async function insertHero(
  tx: IdempotencyTransaction,
  row: NewHeroRow,
): Promise<HeroResponse> {
  try {
    await tx.insert(heroes).values(row);
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      throw duplicateHero(
        "Já existe um herói com o mesmo nome, nome de guerra e data de nascimento.",
      );
    }
    throw error;
  }

  return mapRowToHeroResponse({ ...row, deleted_at: null });
}
