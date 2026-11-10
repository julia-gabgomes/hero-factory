export const MISSION_STATUSES = [
  "scheduled",
  "in_progress",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export type MissionStatusValue = (typeof MISSION_STATUSES)[number];
