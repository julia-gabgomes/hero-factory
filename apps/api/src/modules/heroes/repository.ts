import { eq } from "drizzle-orm";
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

export async function findHeroById(db: Database, id: string): Promise<HeroResponse | null> {
  const [row] = await db.select().from(heroes).where(eq(heroes.id, id)).limit(1);

  if (!row) {
    return null;
  }

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

export async function insertHero(
  tx: IdempotencyTransaction,
  row: NewHeroRow,
): Promise<HeroResponse> {
  await tx.insert(heroes).values(row);

  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname,
    universe: row.universe,
    main_power: row.main_power,
    date_of_birth: row.date_of_birth,
    avatar_url: row.avatar_url,
    is_active: row.is_active,
    deleted_at: null,
    version: row.version,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
