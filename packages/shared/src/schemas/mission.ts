import { z } from "zod";
import { limits } from "../limits.js";
import { MISSION_STATUSES } from "../domain/mission-status.js";
import { heroResponseSchema } from "./hero.js";
import { requiredText } from "./text.js";

export const missionStatusSchema = z.enum(MISSION_STATUSES);

export type MissionStatus = z.infer<typeof missionStatusSchema>;

const missionDateTimeSchema = z
  .string()
  .datetime({ message: "Deve ser uma data e hora ISO 8601 em UTC (com Z)." });

export const createMissionSchema = z
  .object({
    title: requiredText(limits.mission.title),
    starts_at: missionDateTimeSchema,
    ends_at: missionDateTimeSchema,
  })
  .refine(
    (data) =>
      new Date(data.ends_at).getTime() > new Date(data.starts_at).getTime(),
    {
      message: "O fim da missão deve ser depois do início.",
      path: ["ends_at"],
    },
  );

export type CreateMissionInput = z.infer<typeof createMissionSchema>;

export const assignHeroToMissionSchema = z.object({
  hero_id: z.string().min(1, { message: "Campo obrigatório." }),
});

export type AssignHeroToMissionInput = z.infer<
  typeof assignHeroToMissionSchema
>;

export const missionOutcomeSchema = z.enum(["succeeded", "failed"]);

export const finishMissionSchema = z.object({
  outcome: missionOutcomeSchema,
});

export type FinishMissionInput = z.infer<typeof finishMissionSchema>;

export const missionResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: missionStatusSchema,
  starts_at: z.string(),
  ends_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type MissionResponse = z.infer<typeof missionResponseSchema>;

export const missionDetailSchema = missionResponseSchema.extend({
  heroes: z.array(heroResponseSchema),
});

export type MissionDetail = z.infer<typeof missionDetailSchema>;

export const missionListItemSchema = missionResponseSchema.extend({
  assigned_heroes: z.array(
    z.object({ id: z.string(), nickname: z.string() }),
  ),
  assigned_heroes_total: z.number().int().nonnegative(),
});

export type MissionListItem = z.infer<typeof missionListItemSchema>;

export const missionStatusListSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (!Array.isArray(value) && typeof value !== "string") {
    return value;
  }
  const raw = Array.isArray(value) ? value : value.split(",");
  const values = raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return values.length > 0 ? values : undefined;
}, z.array(missionStatusSchema).min(1).optional());

export const listMissionsQuerySchema = z.object({
  cursor: z.string().optional(),
  status: missionStatusListSchema,
});

export type ListMissionsQuery = z.infer<typeof listMissionsQuerySchema>;
