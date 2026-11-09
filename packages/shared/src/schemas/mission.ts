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

export const createMissionSchema = z.object({
  title: requiredText(limits.mission.title),
});

export type CreateMissionInput = z.infer<typeof createMissionSchema>;
