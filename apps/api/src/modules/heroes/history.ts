import type { HeroResponse } from "./repository.js";
import type { HeroUpdateFields } from "./repository.js";

export type HeroChangeEvent =
  "created" | "updated" | "activated" | "inactivated" | "deleted";

export interface HeroChangeInput {
  hero_id: string;
  event: HeroChangeEvent;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: Date;
}

export function diffCreatedHero(
  hero: HeroResponse,
  now: Date,
): HeroChangeInput[] {
  const fieldEntries: Array<[string, string | null]> = [
    ["name", hero.name],
    ["nickname", hero.nickname],
    ["universe", hero.universe],
    ["main_power", hero.main_power],
    ["date_of_birth", hero.date_of_birth],
  ];

  if (hero.avatar_url !== null) {
    fieldEntries.push(["avatar_url", hero.avatar_url]);
  }

  return fieldEntries.map(([field, value]) => ({
    hero_id: hero.id,
    event: "created",
    field,
    old_value: null,
    new_value: value,
    created_at: now,
  }));
}

export function diffUpdatedHero(
  before: HeroResponse,
  fields: HeroUpdateFields,
  now: Date,
): HeroChangeInput[] {
  const changes: HeroChangeInput[] = [];

  for (const key of Object.keys(fields) as Array<keyof HeroUpdateFields>) {
    const newValue = fields[key] ?? null;
    const oldValue = before[key] ?? null;

    if (oldValue !== newValue) {
      changes.push({
        hero_id: before.id,
        event: "updated",
        field: key,
        old_value: oldValue,
        new_value: newValue,
        created_at: now,
      });
    }
  }

  return changes;
}

export function diffDeletedHero(
  hero: HeroResponse,
  now: Date,
): HeroChangeInput[] {
  return [
    {
      hero_id: hero.id,
      event: "deleted",
      field: "deleted_at",
      old_value: null,
      new_value: now.toISOString(),
      created_at: now,
    },
  ];
}

export function diffActiveStateChange(
  hero: HeroResponse,
  isActive: boolean,
  now: Date,
): HeroChangeInput[] {
  return [
    {
      hero_id: hero.id,
      event: isActive ? "activated" : "inactivated",
      field: "is_active",
      old_value: String(hero.is_active),
      new_value: String(isActive),
      created_at: now,
    },
  ];
}
