import type { MissionStatus } from "@hero-factory/shared";
import { Badge, type BadgeProps } from "../../../components/ui/badge.js";

const STATUS_LABELS: Record<MissionStatus, string> = {
  scheduled: "Agendada",
  in_progress: "Em andamento",
  succeeded: "Sucesso",
  failed: "Fracasso",
  cancelled: "Cancelada",
};

const STATUS_TONES: Record<MissionStatus, NonNullable<BadgeProps["tone"]>> = {
  scheduled: "neutral",
  in_progress: "primary",
  succeeded: "success",
  failed: "danger",
  cancelled: "neutral",
};

export function MissionStatusBadge({ status }: { status: MissionStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
