import type { MissionStatus } from "@hero-factory/shared";
import { Badge } from "../../../components/ui/badge.js";
import {
  MISSION_STATUS_LABELS,
  MISSION_STATUS_TONES,
} from "../mission-status-labels.js";

export function MissionStatusBadge({ status }: { status: MissionStatus }) {
  return (
    <Badge tone={MISSION_STATUS_TONES[status]}>
      {MISSION_STATUS_LABELS[status]}
    </Badge>
  );
}
