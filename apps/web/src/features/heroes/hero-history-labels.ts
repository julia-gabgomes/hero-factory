import type { HeroChangeEvent } from "@hero-factory/shared";
import type { BadgeProps } from "../../components/ui/badge.js";

export const FIELD_LABELS: Record<string, string> = {
  name: "Nome completo",
  nickname: "Nome de guerra",
  universe: "Universo",
  main_power: "Habilidade",
  date_of_birth: "Data de nascimento",
  avatar_url: "Avatar",
  is_active: "Situação",
  deleted_at: "Exclusão",
};

export const EVENT_LABELS: Record<HeroChangeEvent, string> = {
  created: "Criado",
  updated: "Alterado",
  activated: "Ativado",
  inactivated: "Inativado",
  deleted: "Excluído",
};

export const HISTORY_EVENT_TONES: Record<
  HeroChangeEvent,
  NonNullable<BadgeProps["tone"]>
> = {
  created: "neutral",
  updated: "primary",
  activated: "success",
  inactivated: "danger",
  deleted: "danger",
};

export interface HistoryFilterField {
  field: string;
  label: string;
}

export const HISTORY_FILTER_FIELDS: HistoryFilterField[] = [
  { field: "is_active", label: "Situação" },
  { field: "universe", label: "Universo" },
  { field: "nickname", label: "Nome de guerra" },
  { field: "name", label: "Nome civil" },
  { field: "main_power", label: "Poderes" },
];

export function formatHistoryValue(
  field: string | null,
  value: string | null,
): string | null {
  if (value === null) return null;
  if (field === "is_active") {
    return value === "true" ? "Ativo" : "Inativo";
  }
  return value;
}
