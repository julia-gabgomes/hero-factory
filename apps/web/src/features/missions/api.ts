import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  type AssignHeroToMissionInput,
  type CreateMissionInput,
  type CursorPage,
  type ListMissionsQuery,
  type MissionDetail,
  missionResponseSchema,
} from "@hero-factory/shared";
import { ApiError, apiClient } from "../../lib/api-client.js";
import { missionKeys } from "../../lib/query-keys.js";

export type MissionPage = CursorPage<typeof missionResponseSchema>;

function genericErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function useMissionsQuery(params: ListMissionsQuery) {
  return useQuery({
    queryKey: missionKeys.list(params),
    queryFn: ({ signal }) =>
      apiClient.get<MissionPage>(
        "/missions",
        { cursor: params.cursor },
        signal,
      ),
  });
}

export function useMissionQuery(id: string | undefined) {
  return useQuery({
    queryKey: missionKeys.detail(id ?? ""),
    queryFn: () => apiClient.get<MissionDetail>(`/missions/${id ?? ""}`),
    enabled: id !== undefined,
  });
}

// createMission não mostra toast de erro aqui: erro de campo (422) é
// tratado no próprio formulário, igual a createHero.
export function useCreateMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      body: CreateMissionInput;
      idempotencyKey: string;
    }) =>
      apiClient.post<MissionDetail>("/missions", params.body, {
        idempotencyKey: params.idempotencyKey,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: missionKeys.lists() });
      toast.success("Missão criada com sucesso.");
    },
  });
}

function useMissionTransition(
  action: (id: string) => Promise<MissionDetail>,
  successMessage: string,
  errorFallback: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: (mission) => {
      void queryClient.invalidateQueries({ queryKey: missionKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: missionKeys.detail(mission.id),
      });
      toast.success(successMessage);
    },
    onError: (error: unknown) => {
      toast.error(genericErrorMessage(error, errorFallback));
    },
  });
}

export function useStartMission() {
  return useMissionTransition(
    (id) => apiClient.post<MissionDetail>(`/missions/${id}/start`),
    "Missão iniciada com sucesso.",
    "Não foi possível iniciar a missão.",
  );
}

export function useCancelMission() {
  return useMissionTransition(
    (id) => apiClient.post<MissionDetail>(`/missions/${id}/cancel`),
    "Missão cancelada com sucesso.",
    "Não foi possível cancelar a missão.",
  );
}

export function useFinishMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; outcome: "succeeded" | "failed" }) =>
      apiClient.post<MissionDetail>(`/missions/${params.id}/finish`, {
        outcome: params.outcome,
      }),
    onSuccess: (mission) => {
      void queryClient.invalidateQueries({ queryKey: missionKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: missionKeys.detail(mission.id),
      });
      toast.success("Missão encerrada com sucesso.");
    },
    onError: (error) => {
      toast.error(
        genericErrorMessage(error, "Não foi possível encerrar a missão."),
      );
    },
  });
}

export function useAssignHero() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      missionId: string;
      body: AssignHeroToMissionInput;
    }) =>
      apiClient.post<MissionDetail>(
        `/missions/${params.missionId}/heroes`,
        params.body,
      ),
    onSuccess: (mission) => {
      void queryClient.invalidateQueries({
        queryKey: missionKeys.detail(mission.id),
      });
      toast.success("Herói escalado com sucesso.");
    },
    onError: (error) => {
      toast.error(
        genericErrorMessage(error, "Não foi possível escalar o herói."),
      );
    },
  });
}

export function useUnassignHero() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { missionId: string; heroId: string }) =>
      apiClient.delete<MissionDetail>(
        `/missions/${params.missionId}/heroes/${params.heroId}`,
      ),
    onSuccess: (mission) => {
      void queryClient.invalidateQueries({
        queryKey: missionKeys.detail(mission.id),
      });
      toast.success("Herói removido da missão.");
    },
    onError: (error) => {
      toast.error(
        genericErrorMessage(error, "Não foi possível remover o herói."),
      );
    },
  });
}
