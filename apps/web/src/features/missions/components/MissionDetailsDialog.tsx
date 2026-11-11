import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "../../../components/ui/dialog.js";
import { ErrorState } from "../../../components/ui/error-state.js";
import { LoadingState } from "../../../components/ui/loading-state.js";
import { formatDateTime } from "../../../lib/dates.js";
import { useHeroesQuery } from "../../heroes/api.js";
import {
  useAssignHero,
  useCancelMission,
  useFinishMission,
  useMissionQuery,
  useStartMission,
  useUnassignHero,
} from "../api.js";
import { MissionStatusBadge } from "./MissionStatusBadge.js";

export interface MissionDetailsDialogProps {
  missionId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MissionDetailsDialog({
  missionId,
  open,
  onOpenChange,
}: MissionDetailsDialogProps) {
  const missionQuery = useMissionQuery(missionId);
  const startMission = useStartMission();
  const cancelMission = useCancelMission();
  const finishMission = useFinishMission();
  const unassignHero = useUnassignHero();

  const [heroSearch, setHeroSearch] = useState("");
  const heroesQuery = useHeroesQuery({ q: heroSearch || undefined });
  const assignHero = useAssignHero();

  const mission = missionQuery.data;
  const isScheduled = mission?.status === "scheduled";
  const isInProgress = mission?.status === "in_progress";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title={mission?.title ?? "Missão"} />
        <DialogBody>
          {missionQuery.isPending ? (
            <LoadingState label="Carregando missão…" />
          ) : missionQuery.isError || !mission ? (
            <ErrorState
              message="Não foi possível carregar a missão."
              onRetry={() => void missionQuery.refetch()}
            />
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {formatDateTime(mission.starts_at)} –{" "}
                  {formatDateTime(mission.ends_at)}
                </p>
                <MissionStatusBadge status={mission.status} />
              </div>

              <div className="flex flex-wrap gap-2">
                {isScheduled ? (
                  <Button
                    shape="rect"
                    disabled={startMission.isPending}
                    onClick={() => {
                      startMission.mutate(mission.id);
                    }}
                  >
                    Iniciar
                  </Button>
                ) : null}
                {isInProgress ? (
                  <>
                    <Button
                      shape="rect"
                      disabled={finishMission.isPending}
                      onClick={() => {
                        finishMission.mutate({
                          id: mission.id,
                          outcome: "succeeded",
                        });
                      }}
                    >
                      Encerrar com sucesso
                    </Button>
                    <Button
                      variant="outline"
                      shape="rect"
                      disabled={finishMission.isPending}
                      onClick={() => {
                        finishMission.mutate({
                          id: mission.id,
                          outcome: "failed",
                        });
                      }}
                    >
                      Encerrar com fracasso
                    </Button>
                  </>
                ) : null}
                {isScheduled || isInProgress ? (
                  <Button
                    variant="outline"
                    shape="rect"
                    disabled={cancelMission.isPending}
                    onClick={() => {
                      cancelMission.mutate(mission.id);
                    }}
                  >
                    Cancelar missão
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <p className="font-bold text-gray-900">Heróis escalados</p>
                {mission.heroes.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhum herói escalado ainda.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {mission.heroes.map((hero) => (
                      <li
                        key={hero.id}
                        className="flex items-center justify-between rounded-lg border border-border px-4 py-2 text-sm"
                      >
                        <span>{hero.nickname}</span>
                        {isScheduled ? (
                          <button
                            type="button"
                            aria-label={`Remover ${hero.nickname} da missão`}
                            onClick={() => {
                              unassignHero.mutate({
                                missionId: mission.id,
                                heroId: hero.id,
                              });
                            }}
                            className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-danger"
                          >
                            <X className="size-4" aria-hidden="true" />
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                {isScheduled ? (
                  <div className="flex flex-col gap-2 pt-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="font-bold text-gray-900">
                        Escalar herói
                      </span>
                      <input
                        type="text"
                        placeholder="Buscar herói por nome ou nome de guerra"
                        value={heroSearch}
                        onChange={(event) => {
                          setHeroSearch(event.target.value);
                        }}
                        className="w-full rounded-full border border-border px-4 py-2 text-sm"
                      />
                    </label>
                    {heroSearch ? (
                      <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                        {(heroesQuery.data?.data ?? [])
                          .filter(
                            (hero) =>
                              hero.is_active &&
                              !mission.heroes.some(
                                (assigned) => assigned.id === hero.id,
                              ),
                          )
                          .map((hero) => (
                            <li
                              key={hero.id}
                              className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50"
                            >
                              <span>{hero.nickname}</span>
                              <Button
                                type="button"
                                variant="outline"
                                shape="rect"
                                disabled={assignHero.isPending}
                                onClick={() => {
                                  assignHero.mutate({
                                    missionId: mission.id,
                                    body: { hero_id: hero.id },
                                  });
                                }}
                              >
                                Escalar
                              </Button>
                            </li>
                          ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            shape="rect"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
