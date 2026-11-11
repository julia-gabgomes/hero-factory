import type { MissionStatus } from "@hero-factory/shared";
import { Badge } from "../../../components/ui/badge.js";
import {
  MISSION_STATUS_DOT_CLASSES,
  MISSION_STATUS_LABELS,
  MISSION_STATUS_TONES,
} from "../mission-status-labels.js";

export function MissionStatusBadge({ status }: { status: MissionStatus }) {
  return (
    <Badge tone={MISSION_STATUS_TONES[status]}>
      <span
        className={`mr-1.5 inline-block size-1.5 rounded-full ${MISSION_STATUS_DOT_CLASSES[status]}`}
        aria-hidden="true"
      />
      {MISSION_STATUS_LABELS[status]}
    </Badge>
  );
}
