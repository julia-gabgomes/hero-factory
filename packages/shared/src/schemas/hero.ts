import { z } from "zod";
import { limits } from "../limits.js";
import { isFutureUtcPlus14 } from "../dates/not-future.js";
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
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
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
