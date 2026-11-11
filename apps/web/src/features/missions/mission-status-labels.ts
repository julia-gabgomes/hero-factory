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
  scheduled: "primary",
  in_progress: "warning",
  succeeded: "success",
  failed: "danger",
  cancelled: "neutral",
};

export const MISSION_STATUS_DOT_CLASSES: Record<MissionStatus, string> = {
  scheduled: "bg-primary",
  in_progress: "bg-amber-600",
  succeeded: "bg-green-600",
  failed: "bg-danger",
  cancelled: "bg-gray-400",
};
