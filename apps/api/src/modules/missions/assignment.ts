import type { Database } from "../../db/client.js";
import { findHeroByIdForUpdate } from "../heroes/repository.js";
import { invalidState, notFound, scheduleConflict } from "../../http/errors.js";
import {
  deleteMissionHero,
  findMissionByIdForUpdate,
  findOverlappingMission,
  insertMissionHero,
  listAssignedHeroes,
  type MissionResponse,
} from "./repository.js";

export interface MissionWithHeroes extends MissionResponse {
  heroes: Awaited<ReturnType<typeof listAssignedHeroes>>;
}

export async function assignHeroToMission(
  db: Database,
  params: { missionId: string; heroId: string },
): Promise<MissionWithHeroes> {
  const { missionId, heroId } = params;

  return db.transaction(async (tx) => {
    const hero = await findHeroByIdForUpdate(tx, heroId);

    if (!hero || hero.deleted_at !== null) {
      throw notFound("Herói não encontrado.");
    }

    if (!hero.is_active) {
      throw invalidState("Herói inativo não pode ser escalado.");
    }

    const mission = await findMissionByIdForUpdate(tx, missionId);

    if (!mission) {
      throw notFound("Missão não encontrada.");
    }

    if (mission.status !== "scheduled") {
      throw invalidState("Só é possível escalar heróis numa missão agendada.");
    }

    const conflicting = await findOverlappingMission(tx, {
      heroId,
      startsAt: new Date(mission.starts_at),
      endsAt: new Date(mission.ends_at),
    });

    if (conflicting) {
      throw scheduleConflict(
        `${hero.nickname} já está na missão "${conflicting.title}".`,
        { mission: conflicting },
      );
    }

    await insertMissionHero(tx, { missionId, heroId });

    const heroesInMission = await listAssignedHeroes(tx, missionId);

    return { ...mission, heroes: heroesInMission };
  });
}

export async function unassignHeroFromMission(
  db: Database,
  params: { missionId: string; heroId: string },
): Promise<MissionWithHeroes> {
  const { missionId, heroId } = params;

  return db.transaction(async (tx) => {
    const mission = await findMissionByIdForUpdate(tx, missionId);

    if (!mission) {
      throw notFound("Missão não encontrada.");
    }

    if (mission.status !== "scheduled") {
      throw invalidState(
        "Só é possível remover heróis de uma missão agendada.",
      );
    }

    const affectedRows = await deleteMissionHero(tx, { missionId, heroId });

    if (affectedRows === 0) {
      throw notFound("Herói não está escalado nesta missão.");
    }

    const heroesInMission = await listAssignedHeroes(tx, missionId);

    return { ...mission, heroes: heroesInMission };
  });
}
