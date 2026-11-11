import type { MissionStatus } from "@hero-factory/shared";
import type { BadgeProps } from "../../components/ui/badge.js";

export const MISSION_STATUS_LABELS: Record<MissionStatus, string> = {
  scheduled: "Agendada",
  in_progress: "Em andamento",
  succeeded: "Sucesso",
  failed: "Fracasso",
  cancelled: "Cancelada",
};

export const MISSION_STATUS_TONES: Record<
  MissionStatus,
  NonNullable<BadgeProps["tone"]>
> = {
  scheduled: "neutral",
  in_progress: "primary",
  succeeded: "success",
  failed: "danger",
  cancelled: "neutral",
};
