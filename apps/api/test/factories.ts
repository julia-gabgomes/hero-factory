import { randomUUID } from "node:crypto";
import type { heroes } from "../src/db/schema/heroes.js";
import type { missions } from "../src/db/schema/missions.js";

export type HeroInsert = typeof heroes.$inferInsert;
export type MissionInsert = typeof missions.$inferInsert;

export function buildHeroRow(overrides: Partial<HeroInsert> = {}): HeroInsert {
  const now = new Date("2024-05-01T10:00:00.000Z");
  const suffix = randomUUID();
  return {
    id: randomUUID(),
    name: `Teste Herói ${suffix}`,
    nickname: `Nick ${suffix}`,
    universe: "Universo de teste",
    main_power: "Poder de teste",
    date_of_birth: "1990-06-18",
    avatar_url: null,
    is_active: true,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export function buildMissionRow(overrides: Partial<MissionInsert> = {}): MissionInsert {
  const startsAt = new Date("2024-05-01T10:00:00.000Z");
  const endsAt = new Date("2024-05-01T12:00:00.000Z");
  const now = new Date("2024-05-01T09:00:00.000Z");
  return {
    id: randomUUID(),
    title: `Missão de teste ${randomUUID()}`,
    status: "scheduled",
    starts_at: startsAt,
    ends_at: endsAt,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}
