import type { MissionListItem } from "@hero-factory/shared";
import { Calendar } from "lucide-react";
import { formatDateTime } from "../../../lib/dates.js";
import { HeroAvatarStack } from "./HeroAvatarStack.js";
import { MissionCardMenu } from "./MissionCardMenu.js";
import { MissionStatusBadge } from "./MissionStatusBadge.js";

export interface MissionCardProps {
  mission: MissionListItem;
  onOpenDetails: (id: string) => void;
}

const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled"]);

export function MissionCard({ mission, onOpenDetails }: MissionCardProps) {
  const isTerminal = TERMINAL_STATUSES.has(mission.status);

  return (
    <div className="flex flex-col gap-3 rounded-card bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <MissionStatusBadge status={mission.status} />
        {isTerminal ? null : (
          <MissionCardMenu
            missionId={mission.id}
            missionTitle={mission.title}
            status={mission.status}
            assignedHeroesTotal={mission.assigned_heroes_total}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          onOpenDetails(mission.id);
        }}
        className="flex flex-col gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <p className="truncate text-lg font-bold text-gray-900" title={mission.title}>
          {mission.title}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-gray-500">
          <Calendar className="size-4 shrink-0" aria-hidden="true" />
          {formatDateTime(mission.starts_at)} – {formatDateTime(mission.ends_at)}
        </p>

        <hr className="border-border" />

        <HeroAvatarStack
          heroes={mission.assigned_heroes}
          total={mission.assigned_heroes_total}
        />
      </button>
    </div>
  );
}
