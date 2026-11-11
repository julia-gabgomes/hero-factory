import type { MissionResponse } from "@hero-factory/shared";
import { formatDateTime } from "../../../lib/dates.js";
import { MissionStatusBadge } from "./MissionStatusBadge.js";

export interface MissionCardProps {
  mission: MissionResponse;
  onOpenDetails: (id: string) => void;
}

export function MissionCard({ mission, onOpenDetails }: MissionCardProps) {
  return (
    <button
      type="button"
      onClick={() => {
        onOpenDetails(mission.id);
      }}
      className="flex flex-col gap-3 rounded-card bg-white p-5 text-left shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate font-medium text-gray-900" title={mission.title}>
          {mission.title}
        </p>
        <MissionStatusBadge status={mission.status} />
      </div>
      <p className="text-sm text-gray-500">
        {formatDateTime(mission.starts_at)} – {formatDateTime(mission.ends_at)}
      </p>
    </button>
  );
}
