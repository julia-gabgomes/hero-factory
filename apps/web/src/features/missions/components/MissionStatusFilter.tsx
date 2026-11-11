import { MISSION_STATUSES, type MissionStatus } from "@hero-factory/shared";
import { Check } from "lucide-react";
import { cn } from "../../../lib/cn.js";
import {
  MISSION_STATUS_DOT_CLASSES,
  MISSION_STATUS_LABELS,
} from "../mission-status-labels.js";

interface MissionStatusFilterProps {
  value: MissionStatus[];
  onChange: (next: MissionStatus[]) => void;
}

export function MissionStatusFilter({
  value,
  onChange,
}: MissionStatusFilterProps) {
  const allSelected = value.length === 0;

  return (
    <div
      role="group"
      aria-label="Filtrar por situação"
      className="flex flex-wrap gap-2"
    >
      <button
        type="button"
        aria-pressed={allSelected}
        onClick={() => {
          onChange([]);
        }}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
          allSelected
            ? "border-primary bg-primary text-white"
            : "border-border bg-white text-gray-700",
        )}
      >
        {allSelected ? (
          <Check className="size-3.5" aria-hidden="true" />
        ) : null}
        Todas
      </button>

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
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
              selected
                ? `border-transparent text-white ${MISSION_STATUS_DOT_CLASSES[status]}`
                : "border-border bg-white text-gray-700",
            )}
          >
            <span
              className={cn(
                "inline-block size-1.5 rounded-full",
                selected ? "bg-white" : MISSION_STATUS_DOT_CLASSES[status],
              )}
              aria-hidden="true"
            />
            {MISSION_STATUS_LABELS[status]}
          </button>
        );
      })}
    </div>
  );
}
