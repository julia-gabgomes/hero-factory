import { MISSION_STATUSES, type MissionStatus } from "@hero-factory/shared";
import { cn } from "../../../lib/cn.js";
import { MISSION_STATUS_LABELS } from "../mission-status-labels.js";

interface MissionStatusFilterProps {
  value: MissionStatus[];
  onChange: (next: MissionStatus[]) => void;
}

export function MissionStatusFilter({
  value,
  onChange,
}: MissionStatusFilterProps) {
  return (
    <div
      role="group"
      aria-label="Filtrar por situação"
      className="flex flex-wrap gap-2"
    >
      {MISSION_STATUSES.map((status) => {
        const selected = value.includes(status);
        return (
          <button
            key={status}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              onChange(
                selected
                  ? value.filter((current) => current !== status)
                  : [...value, status],
              );
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              selected
                ? "border-primary bg-primary text-white"
                : "border-border bg-white text-gray-700",
            )}
          >
            {MISSION_STATUS_LABELS[status]}
          </button>
        );
      })}
    </div>
  );
}
