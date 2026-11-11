import type {
  HeroChange,
  HeroResponse,
  MissionDetail,
  MissionListItem,
} from "@hero-factory/shared";

export function buildHeroFixture(
  overrides: Partial<HeroResponse> = {},
): HeroResponse {
  const now = "2024-05-01T10:00:00.000Z";
  return {
    id: "01971f6e-0000-7000-8000-000000000001",
    name: "Clark Kent",
    nickname: "Super-Homem",
    universe: "DC",
    main_power: "Voo",
    date_of_birth: "1990-06-18",
    avatar_url: null,
    is_active: true,
    deleted_at: null,
    version: 1,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export function buildHeroChangeFixture(
  overrides: Partial<HeroChange> = {},
): HeroChange {
  return {
    event: "updated",
    field: "nickname",
    old_value: "Super-Homem",
    new_value: "Homem de Aço",
    created_at: "2024-05-01T10:00:00.000Z",
    ...overrides,
  };
}

export function buildMissionFixture(
  overrides: Partial<MissionDetail> = {},
): MissionDetail {
  const now = "2024-05-01T09:00:00.000Z";
  return {
    id: "01971f6e-0000-7000-8000-000000000101",
    title: "Resgate no centro",
    status: "scheduled",
    starts_at: "2024-05-01T10:00:00.000Z",
    ends_at: "2024-05-01T12:00:00.000Z",
    created_at: now,
    updated_at: now,
    heroes: [],
    ...overrides,
  };
}

export function buildMissionListItemFixture(
  overrides: Partial<MissionListItem> = {},
): MissionListItem {
  const now = "2024-05-01T09:00:00.000Z";
  return {
    id: "01971f6e-0000-7000-8000-000000000101",
    title: "Resgate no centro",
    status: "scheduled",
    starts_at: "2024-05-01T10:00:00.000Z",
    ends_at: "2024-05-01T12:00:00.000Z",
    created_at: now,
    updated_at: now,
    assigned_heroes: [],
    assigned_heroes_total: 0,
    ...overrides,
  };
}
