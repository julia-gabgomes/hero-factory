import type {
  HeroMissionsQuery,
  ListHeroesQuery,
  ListMissionsQuery,
} from "@hero-factory/shared";

export const heroKeys = {
  all: ["heroes"] as const,
  lists: () => [...heroKeys.all, "list"] as const,
  list: (params: ListHeroesQuery) => [...heroKeys.lists(), params] as const,
  details: () => [...heroKeys.all, "detail"] as const,
  detail: (id: string) => [...heroKeys.details(), id] as const,
  history: (id: string, params: Record<string, string | undefined>) =>
    [...heroKeys.detail(id), "history", params] as const,
  missions: (id: string, params: HeroMissionsQuery) =>
    [...heroKeys.detail(id), "missions", params] as const,
};

export const missionKeys = {
  all: ["missions"] as const,
  lists: () => [...missionKeys.all, "list"] as const,
  list: (params: ListMissionsQuery) =>
    [...missionKeys.lists(), params] as const,
  details: () => [...missionKeys.all, "detail"] as const,
  detail: (id: string) => [...missionKeys.details(), id] as const,
};
