import { useState } from "react";
import { Calendar, CircleX, Search, UserPlus, X } from "lucide-react";
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
import { formatMissionDateTime } from "../../../lib/dates.js";
import { useHeroesQuery } from "../../heroes/api.js";
import {
  useAssignHero,
  useCancelMission,
  useFinishMission,
  useMissionQuery,
  useStartMission,
  useUnassignHero,
} from "../api.js";
import { formatAssignedHeroesLabel } from "../hero-avatar.js";
import { HeroAvatarCircle } from "./HeroAvatarCircle.js";
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
      <DialogContent className="h-[600px]">
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
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                <MissionStatusBadge status={mission.status} />
                <p className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Calendar className="size-4 shrink-0" aria-hidden="true" />
                  {formatMissionDateTime(mission.starts_at)} –{" "}
                  {formatMissionDateTime(mission.ends_at)}
                </p>
              </div>

              <hr className="border-border" />

              {isScheduled || isInProgress ? (
                <div className="flex flex-wrap items-center gap-4">
                  {isScheduled ? (
                    <Button
                      shape="pill"
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
                        shape="pill"
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
                        shape="pill"
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
                  <button
                    type="button"
                    disabled={cancelMission.isPending}
                    onClick={() => {
                      cancelMission.mutate(mission.id);
                    }}
                    className="flex items-center gap-1.5 text-sm font-medium text-danger hover:underline disabled:pointer-events-none disabled:opacity-50"
                  >
                    <CircleX className="size-4" aria-hidden="true" />
                    Cancelar missão
                  </button>
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-gray-900">Heróis escalados</p>
                  <p className="text-sm text-gray-500">
                    {formatAssignedHeroesLabel(mission.heroes.length)}
                  </p>
                </div>
                {mission.heroes.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhum herói escalado ainda.
                  </p>
                ) : (
                  <ul className="flex flex-col rounded-2xl border border-border">
                    {mission.heroes.map((hero) => (
                      <li
                        key={hero.id}
                        className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0"
                      >
                        <span className="flex items-center gap-3">
                          <HeroAvatarCircle id={hero.id} nickname={hero.nickname} />
                          <span className="font-medium text-gray-900">
                            {hero.nickname}
                          </span>
                        </span>
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
                      <span className="relative">
                        <Search
                          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-gray-400"
                          aria-hidden="true"
                        />
                        <input
                          type="text"
                          placeholder="Buscar pelo nome"
                          value={heroSearch}
                          onChange={(event) => {
                            setHeroSearch(event.target.value);
                          }}
                          className="w-full rounded-full border border-border py-2 pl-10 pr-4 text-sm"
                        />
                      </span>
                    </label>
                    <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
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
                            className="flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50"
                          >
                            <span className="flex items-center gap-3">
                              <HeroAvatarCircle
                                id={hero.id}
                                nickname={hero.nickname}
                              />
                              <span className="font-medium text-gray-900">
                                {hero.nickname}
                              </span>
                            </span>
                            <button
                              type="button"
                              disabled={assignHero.isPending}
                              onClick={() => {
                                assignHero.mutate({
                                  missionId: mission.id,
                                  body: { hero_id: hero.id },
                                });
                              }}
                              className="flex items-center gap-1.5 rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:pointer-events-none disabled:opacity-50"
                            >
                              <UserPlus className="size-4" aria-hidden="true" />
                              Escalar
                            </button>
                          </li>
                        ))}
                    </ul>
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
