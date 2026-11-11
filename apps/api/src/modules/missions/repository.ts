import { and, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import type { MissionStatus } from "@hero-factory/shared";
import { heroes } from "../../db/schema/heroes.js";
import { missions } from "../../db/schema/missions.js";
import { missionHeroes } from "../../db/schema/mission_heroes.js";
import type { Database } from "../../db/client.js";
import type { IdempotencyTransaction } from "../../http/idempotency.js";
import type { HeroListCursor } from "../../http/cursor.js";
import {
  mapRowToHeroResponse,
  type HeroResponse,
} from "../heroes/repository.js";

export type DbExecutor = Database | IdempotencyTransaction;

export interface NewMissionRow {
  id: string;
  title: string;
  status: MissionStatus;
  starts_at: Date;
  ends_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface MissionResponse {
  id: string;
  title: string;
  status: MissionStatus;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
}

interface MissionRow {
  id: string;
  title: string;
  status: string;
  starts_at: Date;
  ends_at: Date;
  created_at: Date;
  updated_at: Date;
}

export function mapRowToMissionResponse(row: MissionRow): MissionResponse {
  return {
    id: row.id,
    title: row.title,
    status: row.status as MissionStatus,
    starts_at: row.starts_at.toISOString(),
    ends_at: row.ends_at.toISOString(),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function findMissionById(
  db: DbExecutor,
  id: string,
): Promise<MissionResponse | null> {
  const [row] = await db
    .select()
    .from(missions)
    .where(eq(missions.id, id))
    .limit(1);

  if (!row) {
    return null;
  }

  return mapRowToMissionResponse(row);
}

export async function findMissionByIdForUpdate(
  tx: IdempotencyTransaction,
  id: string,
): Promise<MissionResponse | null> {
  const [row] = await tx
    .select()
    .from(missions)
    .where(eq(missions.id, id))
    .for("update")
    .limit(1);

  if (!row) {
    return null;
  }

  return mapRowToMissionResponse(row);
}

export async function insertMission(
  tx: IdempotencyTransaction,
  row: NewMissionRow,
): Promise<MissionResponse> {
  await tx.insert(missions).values(row);

  return mapRowToMissionResponse(row);
}

export async function updateMissionStatus(
  tx: IdempotencyTransaction,
  params: {
    id: string;
    from: MissionStatus | MissionStatus[];
    to: MissionStatus;
  },
): Promise<number> {
  const { id, from, to } = params;
  const fromStatuses = Array.isArray(from) ? from : [from];

  const result = await tx
    .update(missions)
    .set({ status: to, updated_at: new Date() })
    .where(and(eq(missions.id, id), inArray(missions.status, fromStatuses)));

  return result[0].affectedRows;
}

export async function countAssignedHeroes(
  tx: IdempotencyTransaction,
  missionId: string,
): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)` })
    .from(missionHeroes)
    .where(eq(missionHeroes.mission_id, missionId));

  return Number(row?.count ?? 0);
}

export async function insertMissionHero(
  tx: IdempotencyTransaction,
  params: { missionId: string; heroId: string },
): Promise<void> {
  await tx
    .insert(missionHeroes)
    .values({ mission_id: params.missionId, hero_id: params.heroId });
}

export async function deleteMissionHero(
  tx: IdempotencyTransaction,
  params: { missionId: string; heroId: string },
): Promise<number> {
  const result = await tx
    .delete(missionHeroes)
    .where(
      and(
        eq(missionHeroes.mission_id, params.missionId),
        eq(missionHeroes.hero_id, params.heroId),
      ),
    );

  return result[0].affectedRows;
}

export interface OverlappingMission {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
}

export async function findOverlappingMission(
  tx: IdempotencyTransaction,
  params: { heroId: string; startsAt: Date; endsAt: Date },
): Promise<OverlappingMission | null> {
  const { heroId, startsAt, endsAt } = params;

  const [row] = await tx
    .select({
      id: missions.id,
      title: missions.title,
      starts_at: missions.starts_at,
      ends_at: missions.ends_at,
    })
    .from(missionHeroes)
    .innerJoin(missions, eq(missions.id, missionHeroes.mission_id))
    .where(
      and(
        eq(missionHeroes.hero_id, heroId),
        inArray(missions.status, ["scheduled", "in_progress"]),
        lt(missions.starts_at, endsAt),
        gt(missions.ends_at, startsAt),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    starts_at: row.starts_at.toISOString(),
    ends_at: row.ends_at.toISOString(),
  };
}

export async function listAssignedHeroes(
  db: DbExecutor,
  missionId: string,
): Promise<HeroResponse[]> {
  const rows = await db
    .select({
      id: heroes.id,
      name: heroes.name,
      nickname: heroes.nickname,
      universe: heroes.universe,
      main_power: heroes.main_power,
      date_of_birth: heroes.date_of_birth,
      avatar_url: heroes.avatar_url,
      is_active: heroes.is_active,
      deleted_at: heroes.deleted_at,
      version: heroes.version,
      created_at: heroes.created_at,
      updated_at: heroes.updated_at,
    })
    .from(missionHeroes)
    .innerJoin(heroes, eq(heroes.id, missionHeroes.hero_id))
    .where(eq(missionHeroes.mission_id, missionId));

  return rows.map((row) => mapRowToHeroResponse(row));
}

export const LIST_PAGE_SIZE = 10;

export interface ListMissionsParams {
  cursor?: HeroListCursor;
  limit?: number;
}

export async function listMissions(
  db: Database,
  params: ListMissionsParams = {},
): Promise<MissionResponse[]> {
  const { cursor, limit = LIST_PAGE_SIZE } = params;

  const conditions = [];

  if (cursor !== undefined) {
    conditions.push(
      sql`(${missions.created_at}, ${missions.id}) < (${new Date(cursor.created_at)}, ${cursor.id})`,
    );
  }

  const rows = await db
    .select()
    .from(missions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(missions.created_at), desc(missions.id))
    .limit(limit);

  return rows.map((row) => mapRowToMissionResponse(row));
}

export interface ListMissionsForHeroParams {
  heroId: string;
  status?: MissionStatus;
  cursor?: HeroListCursor;
  limit?: number;
}

export async function listMissionsForHero(
  db: Database,
  params: ListMissionsForHeroParams,
): Promise<MissionResponse[]> {
  const { heroId, status, cursor, limit = LIST_PAGE_SIZE } = params;

  const conditions = [eq(missionHeroes.hero_id, heroId)];

  if (status !== undefined) {
    conditions.push(eq(missions.status, status));
  }

  if (cursor !== undefined) {
    conditions.push(
      sql`(${missions.created_at}, ${missions.id}) < (${new Date(cursor.created_at)}, ${cursor.id})`,
    );
  }

  const rows = await db
    .select({
      id: missions.id,
      title: missions.title,
      status: missions.status,
      starts_at: missions.starts_at,
      ends_at: missions.ends_at,
      created_at: missions.created_at,
      updated_at: missions.updated_at,
    })
    .from(missionHeroes)
    .innerJoin(missions, eq(missions.id, missionHeroes.mission_id))
    .where(and(...conditions))
    .orderBy(desc(missions.created_at), desc(missions.id))
    .limit(limit);

  return rows.map((row) => mapRowToMissionResponse(row));
}
