import { z } from "zod";
import { limits } from "../limits.js";
import { isFutureUtcPlus14 } from "../dates/not-future.js";
import { MISSION_STATUSES } from "../domain/mission-status.js";
import { cursorPageSchema } from "./common.js";
import { codePointLength, requiredText } from "./text.js";

const avatarUrlPrefixes = ["http://", "https://", "/uploads/"];

function hasValidAvatarUrlPrefix(value: string): boolean {
  return avatarUrlPrefixes.some((prefix) => value.startsWith(prefix));
}

function optionalAvatarUrl(max: number) {
  return z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : value))
    .pipe(
      z
        .string()
        .refine((value) => codePointLength(value) <= max, {
          message: `Deve ter no máximo ${String(max)} caracteres.`,
        })
        .refine((value) => hasValidAvatarUrlPrefix(value), {
          message: "Deve começar com http://, https:// ou /uploads/.",
        })
        .optional(),
    )
    .optional();
}

function isValidCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data inválida." })
  .refine((value) => isValidCalendarDate(value), { message: "Data inválida." })
  .refine((value) => !isFutureUtcPlus14(value, new Date()), {
    message: "Data de nascimento não pode ser no futuro.",
  });

export const createHeroSchema = z.object({
  name: requiredText(limits.name),
  nickname: requiredText(limits.nickname),
  universe: requiredText(limits.universe),
  main_power: requiredText(limits.main_power),
  date_of_birth: dateOfBirthSchema,
  avatar_url: optionalAvatarUrl(limits.avatar_url),
});

export type CreateHeroInput = z.infer<typeof createHeroSchema>;

export const updateHeroSchema = createHeroSchema.partial().extend({
  version: z.number().int(),
});

export type UpdateHeroInput = z.infer<typeof updateHeroSchema>;

export const heroResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  nickname: z.string(),
  universe: z.string(),
  main_power: z.string(),
  date_of_birth: z.string(),
  avatar_url: z.string().nullable(),
  is_active: z.boolean(),
  deleted_at: z.string().nullable(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type HeroResponse = z.infer<typeof heroResponseSchema>;

export const heroChangeEventSchema = z.enum([
  "created",
  "updated",
  "activated",
  "inactivated",
  "deleted",
]);

export type HeroChangeEvent = z.infer<typeof heroChangeEventSchema>;

export const heroChangeSchema = z.object({
  event: heroChangeEventSchema,
  field: z.string().nullable(),
  old_value: z.string().nullable(),
  new_value: z.string().nullable(),
  created_at: z.string(),
});

export type HeroChange = z.infer<typeof heroChangeSchema>;

export const listHeroesQuerySchema = z.object({
  q: z.string().optional(),
  cursor: z.string().optional(),
});

export type ListHeroesQuery = z.infer<typeof listHeroesQuerySchema>;

export const heroHistoryQuerySchema = z.object({
  field: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  cursor: z.string().optional(),
});

export type HeroHistoryQuery = z.infer<typeof heroHistoryQuerySchema>;

export const heroHistoryPageSchema = cursorPageSchema(heroChangeSchema).extend(
  {
    total: z.number().int().nonnegative(),
    field_totals: z.record(z.string(), z.number().int().nonnegative()),
  },
);

export type HeroHistoryPageResponse = z.infer<typeof heroHistoryPageSchema>;

export const heroMissionsQuerySchema = z.object({
  status: z.enum(MISSION_STATUSES).optional(),
  cursor: z.string().optional(),
});

export type HeroMissionsQuery = z.infer<typeof heroMissionsQuerySchema>;
