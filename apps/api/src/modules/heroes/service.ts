import { createHash } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import type { CreateHeroInput, UpdateHeroInput } from "@hero-factory/shared";
import type { Database } from "../../db/client.js";
import { badRequest, notFound, versionConflict } from "../../http/errors.js";
import { decodeCursor, encodeCursor } from "../../http/cursor.js";
import { withIdempotency } from "../../http/idempotency.js";
import {
  LIST_PAGE_SIZE,
  deleteHeroWithOptimisticLock,
  findHeroById,
  insertHero,
  listHeroes,
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

async function resolveOptimisticLockOutcome(
  db: Database,
  id: string,
  affectedRows: number,
): Promise<HeroResponse> {
  if (affectedRows === 0) {
    const current = await findHeroById(db, id);

    if (!current || current.deleted_at !== null) {
      throw notFound("Herói não encontrado.");
    }

    throw versionConflict(
      "O herói foi alterado por outra pessoa depois que você abriu a edição.",
      current,
    );
  }

  const updated = await findHeroById(db, id);

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
  const affectedRows = await updateHeroWithOptimisticLock(db, {
    id,
    version: body.version,
    fields: extractUpdateFields(body),
  });

  return resolveOptimisticLockOutcome(db, id, affectedRows);
}

export async function deleteHero(
  db: Database,
  id: string,
  version: number,
): Promise<HeroResponse> {
  const affectedRows = await deleteHeroWithOptimisticLock(db, { id, version });

  return resolveOptimisticLockOutcome(db, id, affectedRows);
}

export async function activateHero(
  db: Database,
  id: string,
  version: number,
): Promise<HeroResponse> {
  const affectedRows = await setHeroActiveStateWithOptimisticLock(db, {
    id,
    version,
    isActive: true,
  });

  return resolveOptimisticLockOutcome(db, id, affectedRows);
}

export async function deactivateHero(
  db: Database,
  id: string,
  version: number,
): Promise<HeroResponse> {
  const affectedRows = await setHeroActiveStateWithOptimisticLock(db, {
    id,
    version,
    isActive: false,
  });

  return resolveOptimisticLockOutcome(db, id, affectedRows);
}
