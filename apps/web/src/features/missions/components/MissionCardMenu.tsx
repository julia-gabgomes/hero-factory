import { useState } from "react";
import type { MissionStatus } from "@hero-factory/shared";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Ban, CircleCheck, CircleX, MoreVertical, Play } from "lucide-react";
import { Tooltip } from "../../../components/ui/tooltip.js";
import { cn } from "../../../lib/cn.js";
import {
  useCancelMission,
  useFinishMission,
  useStartMission,
} from "../api.js";

export interface MissionCardMenuProps {
  missionId: string;
  status: MissionStatus;
  assignedHeroesTotal: number;
}

export function MissionCardMenu({
  missionId,
  status,
  assignedHeroesTotal,
}: MissionCardMenuProps) {
  const [open, setOpen] = useState(false);
  const startMission = useStartMission();
  const finishMission = useFinishMission();
  const cancelMission = useCancelMission();

  const canStart = status === "scheduled";
  const canFinish = status === "in_progress";

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Mais ações"
          className={cn(
            "rounded-md p-1.5 text-gray-500 hover:bg-gray-100",
            open && "bg-primary-soft text-primary",
          )}
        >
          <MoreVertical className="size-5" aria-hidden="true" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          role="menu"
          side="bottom"
          align="end"
          sideOffset={4}
          className="flex flex-col gap-1 rounded-xl bg-white p-2 shadow-lg"
        >
          {canStart ? (
            <Tooltip
              content={
                assignedHeroesTotal === 0
                  ? "Escale pelo menos um herói para iniciar."
                  : "Iniciar missão"
              }
            >
              <button
                type="button"
                role="menuitem"
                aria-label="Iniciar missão"
                disabled={assignedHeroesTotal === 0 || startMission.isPending}
                onClick={() => {
                  setOpen(false);
                  startMission.mutate(missionId);
                }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-primary hover:bg-primary-soft disabled:pointer-events-none disabled:opacity-40"
              >
                <Play className="size-4" aria-hidden="true" />
                Iniciar missão
              </button>
            </Tooltip>
          ) : null}

          {canFinish ? (
            <>
              <button
                type="button"
                role="menuitem"
                disabled={finishMission.isPending}
                onClick={() => {
                  setOpen(false);
                  finishMission.mutate({ id: missionId, outcome: "succeeded" });
                }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-primary hover:bg-primary-soft disabled:pointer-events-none disabled:opacity-40"
              >
                <CircleCheck className="size-4" aria-hidden="true" />
                Encerrar com sucesso
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={finishMission.isPending}
                onClick={() => {
                  setOpen(false);
                  finishMission.mutate({ id: missionId, outcome: "failed" });
                }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-40"
              >
                <CircleX className="size-4" aria-hidden="true" />
                Encerrar com fracasso
              </button>
            </>
          ) : null}

          <button
            type="button"
            role="menuitem"
            disabled={cancelMission.isPending}
            onClick={() => {
              setOpen(false);
              cancelMission.mutate(missionId);
            }}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-red-50 disabled:pointer-events-none disabled:opacity-40"
          >
            <Ban className="size-4" aria-hidden="true" />
            Cancelar missão
          </button>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
