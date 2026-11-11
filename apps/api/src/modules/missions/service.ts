import { createHash } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import type { CreateMissionInput, MissionStatus } from "@hero-factory/shared";
import type { Database } from "../../db/client.js";
import { badRequest, invalidState, notFound } from "../../http/errors.js";
import { decodeCursor, encodeCursor } from "../../http/cursor.js";
import { withIdempotency } from "../../http/idempotency.js";
import {
  assignHeroToMission as assignHeroToMissionAssignment,
  unassignHeroFromMission as unassignHeroFromMissionAssignment,
  type MissionWithHeroes,
} from "./assignment.js";
import {
  LIST_PAGE_SIZE,
  countAssignedHeroes,
  findMissionByIdForUpdate,
  findMissionById,
  insertMission,
  listAssignedHeroes,
  listAssignedHeroesPreview,
  listMissions,
  updateMissionStatus,
  type MissionResponse,
} from "./repository.js";

export interface CreateMissionParams {
  body: CreateMissionInput;
  idempotencyKey: string;
}

export interface CreateMissionResult {
  status: number;
  body: MissionResponse;
  replayed: boolean;
}

function hashRequestBody(body: CreateMissionInput): string {
  const sortedEntries = Object.keys(body)
    .sort()
    .map((key) => [key, body[key as keyof CreateMissionInput]] as const);

  return createHash("sha256")
    .update(JSON.stringify(sortedEntries))
    .digest("hex");
}

export async function createMission(
  db: Database,
  params: CreateMissionParams,
): Promise<CreateMissionResult> {
  const { body, idempotencyKey } = params;
  const requestHash = hashRequestBody(body);

  const result = await withIdempotency<MissionResponse>(
    db,
    { scope: "missions:create", key: idempotencyKey, requestHash },
    async (tx) => {
      const now = new Date();
      const mission = await insertMission(tx, {
        id: uuidv7(),
        title: body.title,
        status: "scheduled",
        starts_at: new Date(body.starts_at),
        ends_at: new Date(body.ends_at),
        created_at: now,
        updated_at: now,
      });

      return { status: 201, body: mission };
    },
  );

  return {
    status: result.status,
    body: result.body,
    replayed: result.replayed,
  };
}

export interface MissionListItem extends MissionResponse {
  assigned_heroes: { id: string; nickname: string }[];
  assigned_heroes_total: number;
}

export interface MissionPage {
  data: MissionListItem[];
  next_cursor: string | null;
  prev_cursor: string | null;
}

export interface ListMissionsPageParams {
  cursor?: string;
  status?: MissionStatus[];
}

export async function listMissionsPage(
  db: Database,
  params: ListMissionsPageParams = {},
): Promise<MissionPage> {
  const { cursor, status } = params;

  const decodedCursor = cursor !== undefined ? decodeCursor(cursor) : null;

  if (cursor !== undefined && decodedCursor === null) {
    throw badRequest("O cursor de paginação é inválido.");
  }

  const rows = await listMissions(db, {
    cursor: decodedCursor ?? undefined,
    status,
    limit: LIST_PAGE_SIZE + 1,
  });

  const hasNextPage = rows.length > LIST_PAGE_SIZE;
  const pageRows = hasNextPage ? rows.slice(0, LIST_PAGE_SIZE) : rows;
  const lastMission = pageRows.at(-1);

  const next_cursor =
    hasNextPage && lastMission !== undefined
      ? encodeCursor({ created_at: lastMission.created_at, id: lastMission.id })
      : null;

  const heroPreviews = await listAssignedHeroesPreview(
    db,
    pageRows.map((mission) => mission.id),
  );

  const data = pageRows.map((mission) => {
    const preview = heroPreviews[mission.id];
    return {
      ...mission,
      assigned_heroes: preview?.heroes ?? [],
      assigned_heroes_total: preview?.total ?? 0,
    };
  });

  return { data, next_cursor, prev_cursor: null };
}

export interface MissionDetail extends MissionResponse {
  heroes: Awaited<ReturnType<typeof listAssignedHeroes>>;
}

export async function getMissionById(
  db: Database,
  id: string,
): Promise<MissionDetail> {
  const mission = await findMissionById(db, id);

  if (!mission) {
    throw notFound("Missão não encontrada.");
  }

  const heroes = await listAssignedHeroes(db, id);

  return { ...mission, heroes };
}

export async function startMission(
  db: Database,
  id: string,
): Promise<MissionDetail> {
  return db.transaction(async (tx) => {
    const mission = await findMissionByIdForUpdate(tx, id);

    if (!mission) {
      throw notFound("Missão não encontrada.");
    }

    if (mission.status !== "scheduled") {
      throw invalidState("A missão não está agendada.");
    }

    const heroCount = await countAssignedHeroes(tx, id);

    if (heroCount === 0) {
      throw invalidState(
        "A missão precisa de pelo menos um herói para começar.",
      );
    }

    await updateMissionStatus(tx, { id, from: "scheduled", to: "in_progress" });

    const heroes = await listAssignedHeroes(tx, id);

    return { ...mission, status: "in_progress" as const, heroes };
  });
}

export async function finishMission(
  db: Database,
  id: string,
  outcome: "succeeded" | "failed",
): Promise<MissionDetail> {
  return db.transaction(async (tx) => {
    const affectedRows = await updateMissionStatus(tx, {
      id,
      from: "in_progress",
      to: outcome,
    });

    if (affectedRows === 0) {
      const mission = await findMissionByIdForUpdate(tx, id);
      if (!mission) {
        throw notFound("Missão não encontrada.");
      }
      throw invalidState("A missão não está em andamento.");
    }

    const mission = await findMissionById(tx, id);
    if (!mission) {
      throw notFound("Missão não encontrada.");
    }

    const heroes = await listAssignedHeroes(tx, id);

    return { ...mission, heroes };
  });
}

export async function cancelMission(
  db: Database,
  id: string,
): Promise<MissionDetail> {
  return db.transaction(async (tx) => {
    const affectedRows = await updateMissionStatus(tx, {
      id,
      from: ["scheduled", "in_progress"],
      to: "cancelled",
    });

    if (affectedRows === 0) {
      const mission = await findMissionByIdForUpdate(tx, id);
      if (!mission) {
        throw notFound("Missão não encontrada.");
      }
      throw invalidState("A missão não pode ser cancelada no estado atual.");
    }

    const mission = await findMissionById(tx, id);
    if (!mission) {
      throw notFound("Missão não encontrada.");
    }

    const heroes = await listAssignedHeroes(tx, id);

    return { ...mission, heroes };
  });
}

export async function assignHeroToMission(
  db: Database,
  params: { missionId: string; heroId: string },
): Promise<MissionWithHeroes> {
  return assignHeroToMissionAssignment(db, params);
}

export async function unassignHeroFromMission(
  db: Database,
  params: { missionId: string; heroId: string },
): Promise<MissionWithHeroes> {
  return unassignHeroFromMissionAssignment(db, params);
}
