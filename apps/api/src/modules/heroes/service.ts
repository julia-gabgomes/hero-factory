import { createHash } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import type { CreateHeroInput } from "@hero-factory/shared";
import type { Database } from "../../db/client.js";
import { notFound } from "../../http/errors.js";
import { withIdempotency } from "../../http/idempotency.js";
import { findHeroById, insertHero, listHeroes, type HeroResponse } from "./repository.js";

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

  return createHash("sha256").update(JSON.stringify(sortedEntries)).digest("hex");
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

  return { status: result.status, body: result.body, replayed: result.replayed };
}

export interface HeroPage {
  data: HeroResponse[];
  next_cursor: string | null;
  prev_cursor: string | null;
}

export async function listHeroesPage(db: Database): Promise<HeroPage> {
  const data = await listHeroes(db);

  return { data, next_cursor: null, prev_cursor: null };
}

export async function getHeroById(db: Database, id: string): Promise<HeroResponse> {
  const hero = await findHeroById(db, id);

  if (!hero || hero.deleted_at !== null) {
    throw notFound("Herói não encontrado.");
  }

  return hero;
}
