import { z } from "zod";
import { limits } from "../limits.js";
import { requiredText } from "./text.js";

export const missionStatusSchema = z.enum([
  "scheduled",
  "in_progress",
  "succeeded",
  "failed",
  "cancelled",
]);

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
