import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  type CreateHeroInput,
  type CursorPage,
  type HeroHistoryPageResponse,
  type HeroHistoryQuery,
  type HeroMissionsQuery,
  type HeroResponse,
  type ListHeroesQuery,
  type UpdateHeroInput,
  heroResponseSchema,
  missionResponseSchema,
} from "@hero-factory/shared";
import { ApiError, apiClient } from "../../lib/api-client.js";
import { heroKeys } from "../../lib/query-keys.js";

export type HeroPage = CursorPage<typeof heroResponseSchema>;
export type HeroHistoryPage = HeroHistoryPageResponse;
export type HeroMissionsPage = CursorPage<typeof missionResponseSchema>;

export function useHeroesQuery(params: ListHeroesQuery) {
  return useQuery({
    queryKey: heroKeys.list(params),
    queryFn: ({ signal }) =>
      apiClient.get<HeroPage>(
        "/heroes",
        { q: params.q, cursor: params.cursor },
        signal,
      ),
  });
}

export function useHeroQuery(id: string | undefined) {
  return useQuery({
    queryKey: heroKeys.detail(id ?? ""),
    queryFn: () => apiClient.get<HeroResponse>(`/heroes/${id ?? ""}`),
    enabled: id !== undefined,
  });
}

export function useHeroHistoryQuery(id: string, params: HeroHistoryQuery) {
  return useQuery({
    queryKey: heroKeys.history(id, params),
    queryFn: () =>
      apiClient.get<HeroHistoryPage>(`/heroes/${id}/history`, params),
  });
}

export function useHeroMissionsQuery(id: string, params: HeroMissionsQuery) {
  return useQuery({
    queryKey: heroKeys.missions(id, params),
    queryFn: () =>
      apiClient.get<HeroMissionsPage>(`/heroes/${id}/missions`, params),
  });
}

function genericErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

// createHero/updateHero não mostram toast de erro aqui: erro de campo
// (422) e conflito de versão (409) são tratados no próprio formulário
// (setError / merge de três vias), não com um toast genérico.
export function useCreateHero() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { body: CreateHeroInput; idempotencyKey: string }) =>
      apiClient.post<HeroResponse>("/heroes", params.body, {
        idempotencyKey: params.idempotencyKey,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: heroKeys.lists() });
      toast.success("Herói criado com sucesso.");
    },
  });
}

export function useUpdateHero() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; body: UpdateHeroInput }) =>
      apiClient.patch<HeroResponse>(`/heroes/${params.id}`, params.body),
    onSuccess: (hero) => {
      void queryClient.invalidateQueries({ queryKey: heroKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: heroKeys.detail(hero.id),
      });
      toast.success("Herói atualizado com sucesso.");
    },
  });
}

export function useDeleteHero() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; version: number }) =>
      apiClient.delete<HeroResponse>(`/heroes/${params.id}`, {
        version: params.version,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: heroKeys.lists() });
      toast.success("Herói excluído com sucesso.");
    },
    onError: (error) => {
      toast.error(
        genericErrorMessage(error, "Não foi possível excluir o herói."),
      );
    },
  });
}

export function useActivateHero() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; version: number }) =>
      apiClient.post<HeroResponse>(`/heroes/${params.id}/activate`, {
        version: params.version,
      }),
    onSuccess: (hero) => {
      void queryClient.invalidateQueries({ queryKey: heroKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: heroKeys.detail(hero.id),
      });
      toast.success("Herói ativado com sucesso.");
    },
    onError: (error) => {
      toast.error(
        genericErrorMessage(error, "Não foi possível ativar o herói."),
      );
    },
  });
}

export function useDeactivateHero() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; version: number }) =>
      apiClient.post<HeroResponse>(`/heroes/${params.id}/deactivate`, {
        version: params.version,
      }),
    onSuccess: (hero) => {
      void queryClient.invalidateQueries({ queryKey: heroKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: heroKeys.detail(hero.id),
      });
      toast.success("Herói inativado com sucesso.");
    },
    onError: (error) => {
      toast.error(
        genericErrorMessage(error, "Não foi possível inativar o herói."),
      );
    },
  });
}
