import { createHash } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import type {
  CreateHeroInput,
  MissionStatus,
  UpdateHeroInput,
} from "@hero-factory/shared";
import type { Database } from "../../db/client.js";
import { badRequest, notFound, versionConflict } from "../../http/errors.js";
import { decodeCursor, encodeCursor } from "../../http/cursor.js";
import {
  listMissionsForHero,
  LIST_PAGE_SIZE as MISSION_LIST_PAGE_SIZE,
  type MissionResponse,
} from "../missions/repository.js";
import {
  withIdempotency,
  type IdempotencyTransaction,
} from "../../http/idempotency.js";
import {
  diffActiveStateChange,
  diffCreatedHero,
  diffDeletedHero,
  diffUpdatedHero,
  type HeroChangeInput,
} from "./history.js";
import {
  HISTORY_PAGE_SIZE,
  LIST_PAGE_SIZE,
  deleteHeroWithOptimisticLock,
  findHeroById,
  findHeroByIdForUpdate,
  insertHero,
  insertHeroChanges,
  listHeroes,
  listHeroHistory,
  setHeroActiveStateWithOptimisticLock,
  updateHeroWithOptimisticLock,
  type HeroResponse,
  type HeroUpdateFields,
} from "./repository.js";

export interface CreateHeroParams {
  body: CreateHeroInput;
  idempotencyKey: string;
}

export interface CreateHeroResult {
  status: number;
  body: HeroResponse;
  replayed: boolean;
}

function hashRequestBody(body: CreateHeroInput): string {
  const sortedEntries = Object.keys(body)
    .sort()
    .map((key) => [key, body[key as keyof CreateHeroInput]] as const);

  return createHash("sha256")
    .update(JSON.stringify(sortedEntries))
    .digest("hex");
}

export async function createHero(
  db: Database,
  params: CreateHeroParams,
): Promise<CreateHeroResult> {
  const { body, idempotencyKey } = params;
  const requestHash = hashRequestBody(body);

  const result = await withIdempotency<HeroResponse>(
    db,
    { scope: "heroes:create", key: idempotencyKey, requestHash },
    async (tx) => {
      const now = new Date();
      const hero = await insertHero(tx, {
        id: uuidv7(),
        name: body.name,
        nickname: body.nickname,
        universe: body.universe,
        main_power: body.main_power,
        date_of_birth: body.date_of_birth,
        avatar_url: body.avatar_url ?? null,
        is_active: true,
        version: 1,
        created_at: now,
        updated_at: now,
      });

      await insertHeroChanges(tx, diffCreatedHero(hero, now));

      return { status: 201, body: hero };
    },
  );

  return {
    status: result.status,
    body: result.body,
    replayed: result.replayed,
  };
}

export interface HeroPage {
  data: HeroResponse[];
  next_cursor: string | null;
  prev_cursor: string | null;
}

export interface ListHeroesPageParams {
  q?: string;
  cursor?: string;
}

export async function listHeroesPage(
  db: Database,
  params: ListHeroesPageParams = {},
): Promise<HeroPage> {
  const { q, cursor } = params;

  const decodedCursor = cursor !== undefined ? decodeCursor(cursor) : null;

  if (cursor !== undefined && decodedCursor === null) {
    throw badRequest("O cursor de paginação é inválido.");
  }

  const rows = await listHeroes(db, {
    q,
    cursor: decodedCursor ?? undefined,
    limit: LIST_PAGE_SIZE + 1,
  });

  const hasNextPage = rows.length > LIST_PAGE_SIZE;
  const data = hasNextPage ? rows.slice(0, LIST_PAGE_SIZE) : rows;
  const lastHero = data.at(-1);

  const next_cursor =
    hasNextPage && lastHero !== undefined
      ? encodeCursor({ created_at: lastHero.created_at, id: lastHero.id })
      : null;

  return { data, next_cursor, prev_cursor: null };
}

export async function getHeroById(
  db: Database,
  id: string,
): Promise<HeroResponse> {
  const hero = await findHeroById(db, id);

  if (!hero || hero.deleted_at !== null) {
    throw notFound("Herói não encontrado.");
  }

  return hero;
}

function extractUpdateFields(body: UpdateHeroInput): HeroUpdateFields {
  const fields: HeroUpdateFields = {};

  if (body.name !== undefined) fields.name = body.name;
  if (body.nickname !== undefined) fields.nickname = body.nickname;
  if (body.universe !== undefined) fields.universe = body.universe;
  if (body.main_power !== undefined) fields.main_power = body.main_power;
  if (body.date_of_birth !== undefined)
    fields.date_of_birth = body.date_of_birth;
  if (body.avatar_url !== undefined) fields.avatar_url = body.avatar_url;

  return fields;
}

async function lockExistingHeroOrThrow(
  tx: IdempotencyTransaction,
  id: string,
): Promise<HeroResponse> {
  const before = await findHeroByIdForUpdate(tx, id);

  if (!before || before.deleted_at !== null) {
    throw notFound("Herói não encontrado.");
  }

  return before;
}

async function resolveOptimisticLockOutcome(
  tx: IdempotencyTransaction,
  id: string,
  applyUpdate: (before: HeroResponse) => Promise<number>,
  buildChanges: (before: HeroResponse, now: Date) => HeroChangeInput[],
): Promise<HeroResponse> {
  const before = await lockExistingHeroOrThrow(tx, id);

  const affectedRows = await applyUpdate(before);

  if (affectedRows === 0) {
    throw versionConflict(
      "O herói foi alterado por outra pessoa depois que você abriu a edição.",
      before,
    );
  }

  const now = new Date();
  await insertHeroChanges(tx, buildChanges(before, now));

  const updated = await findHeroById(tx, id);

  if (!updated) {
    throw notFound("Herói não encontrado.");
  }

  return updated;
}

export async function updateHero(
  db: Database,
  id: string,
  body: UpdateHeroInput,
): Promise<HeroResponse> {
  const fields = extractUpdateFields(body);

  return db.transaction((tx) =>
    resolveOptimisticLockOutcome(
      tx,
      id,
      () =>
        updateHeroWithOptimisticLock(tx, { id, version: body.version, fields }),
      (before, now) => diffUpdatedHero(before, fields, now),
    ),
  );
}

export async function deleteHero(
  db: Database,
  id: string,
  version: number,
): Promise<HeroResponse> {
  return db.transaction((tx) =>
    resolveOptimisticLockOutcome(
      tx,
      id,
      () => deleteHeroWithOptimisticLock(tx, { id, version }),
      (before, now) => diffDeletedHero(before, now),
    ),
  );
}

async function setHeroActiveState(
  db: Database,
  id: string,
  version: number,
  isActive: boolean,
): Promise<HeroResponse> {
  return db.transaction((tx) =>
    resolveOptimisticLockOutcome(
      tx,
      id,
      () => setHeroActiveStateWithOptimisticLock(tx, { id, version, isActive }),
      (before, now) => diffActiveStateChange(before, isActive, now),
    ),
  );
}

export async function activateHero(
  db: Database,
  id: string,
  version: number,
): Promise<HeroResponse> {
  return setHeroActiveState(db, id, version, true);
}

export async function deactivateHero(
  db: Database,
  id: string,
  version: number,
): Promise<HeroResponse> {
  return setHeroActiveState(db, id, version, false);
}

export interface GetHeroHistoryParams {
  field?: string;
  from?: string;
  to?: string;
  cursor?: string;
}

export interface HeroHistoryItem {
  event: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface HeroHistoryPage {
  data: HeroHistoryItem[];
  next_cursor: string | null;
  prev_cursor: string | null;
}

export async function getHeroHistoryPage(
  db: Database,
  heroId: string,
  params: GetHeroHistoryParams = {},
): Promise<HeroHistoryPage> {
  const { field, from, to, cursor } = params;

  const decodedCursor = cursor !== undefined ? decodeCursor(cursor) : null;

  if (cursor !== undefined && decodedCursor === null) {
    throw badRequest("O cursor de paginação é inválido.");
  }

  const rows = await listHeroHistory(db, {
    heroId,
    field,
    from: from !== undefined ? new Date(from) : undefined,
    to: to !== undefined ? new Date(to) : undefined,
    cursor: decodedCursor ?? undefined,
    limit: HISTORY_PAGE_SIZE + 1,
  });

  const hasNextPage = rows.length > HISTORY_PAGE_SIZE;
  const data = hasNextPage ? rows.slice(0, HISTORY_PAGE_SIZE) : rows;
  const lastRow = data.at(-1);

  const next_cursor =
    hasNextPage && lastRow !== undefined
      ? encodeCursor({
          created_at: lastRow.created_at.toISOString(),
          id: lastRow.id,
        })
      : null;

  return {
    data: data.map((row) => ({
      event: row.event,
      field: row.field,
      old_value: row.old_value,
      new_value: row.new_value,
      created_at: row.created_at.toISOString(),
    })),
    next_cursor,
    prev_cursor: null,
  };
}

export interface GetHeroMissionsParams {
  status?: MissionStatus;
  cursor?: string;
}

export interface HeroMissionsPage {
  data: MissionResponse[];
  next_cursor: string | null;
  prev_cursor: string | null;
}

export async function getHeroMissionsPage(
  db: Database,
  heroId: string,
  params: GetHeroMissionsParams = {},
): Promise<HeroMissionsPage> {
  const { status, cursor } = params;

  const decodedCursor = cursor !== undefined ? decodeCursor(cursor) : null;

  if (cursor !== undefined && decodedCursor === null) {
    throw badRequest("O cursor de paginação é inválido.");
  }

  const rows = await listMissionsForHero(db, {
    heroId,
    status,
    cursor: decodedCursor ?? undefined,
    limit: MISSION_LIST_PAGE_SIZE + 1,
  });

  const hasNextPage = rows.length > MISSION_LIST_PAGE_SIZE;
  const data = hasNextPage ? rows.slice(0, MISSION_LIST_PAGE_SIZE) : rows;
  const lastMission = data.at(-1);

  const next_cursor =
    hasNextPage && lastMission !== undefined
      ? encodeCursor({ created_at: lastMission.created_at, id: lastMission.id })
      : null;

  return { data, next_cursor, prev_cursor: null };
}
