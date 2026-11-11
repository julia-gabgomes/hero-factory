import { useState } from "react";
import { Button } from "../../../components/ui/button.js";
import { EmptyState } from "../../../components/ui/empty-state.js";
import { ErrorState } from "../../../components/ui/error-state.js";
import { Input } from "../../../components/ui/input.js";
import { LoadingState } from "../../../components/ui/loading-state.js";
import { Pagination } from "../../../components/ui/pagination.js";
import { dateTimeLocalToIsoUtc, formatDateTime } from "../../../lib/dates.js";
import { useHeroHistoryQuery } from "../api.js";

const FIELD_LABELS: Record<string, string> = {
  name: "Nome completo",
  nickname: "Nome de guerra",
  universe: "Universo",
  main_power: "Habilidade",
  date_of_birth: "Data de nascimento",
  avatar_url: "Avatar",
  is_active: "Situação",
  deleted_at: "Exclusão",
};

const EVENT_LABELS: Record<string, string> = {
  updated: "Alterado",
  activated: "Ativado",
  inactivated: "Inativado",
  deleted: "Excluído",
};

interface HistoryFilters {
  field?: string;
  from?: string;
  to?: string;
}

export function HeroHistoryTab({ heroId }: { heroId: string }) {
  const [filters, setFilters] = useState<HistoryFilters>({});
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const page = cursorStack.length + 1;
  const hasActiveFilters =
    filters.field !== undefined ||
    filters.from !== undefined ||
    filters.to !== undefined;

  const query = useHeroHistoryQuery(heroId, {
    cursor: cursorStack.at(-1),
    field: filters.field,
    from: filters.from
      ? dateTimeLocalToIsoUtc(`${filters.from}T00:00`)
      : undefined,
    to: filters.to
      ? dateTimeLocalToIsoUtc(`${filters.to}T23:59:59.999`)
      : undefined,
  });

  function updateFilters(patch: HistoryFilters) {
    setFilters((previous) => ({ ...previous, ...patch }));
    setCursorStack([]);
  }

  function clearFilters() {
    setFilters({});
    setCursorStack([]);
  }

  function goNext() {
    const nextCursor = query.data?.next_cursor;
    if (!nextCursor) return;
    setCursorStack((previous) => [...previous, nextCursor]);
  }

  function goPrevious() {
    setCursorStack((previous) => previous.slice(0, -1));
  }

  if (query.isPending) {
    return <LoadingState label="Carregando histórico…" />;
  }

  if (query.isError) {
    return (
      <ErrorState
        message="Não foi possível carregar o histórico."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const filtersBar = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-900">Campo alterado</span>
        <select
          value={filters.field ?? ""}
          onChange={(event) => {
            updateFilters({ field: event.target.value || undefined });
          }}
          className="rounded-full border border-border bg-white px-4 py-2 text-sm text-gray-900 focus:outline-2 focus:outline-offset-2 focus:outline-primary"
        >
          <option value="">Todos os campos</option>
          {Object.entries(FIELD_LABELS).map(([field, label]) => (
            <option key={field} value={field}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label
        htmlFor="history-filter-from"
        className="flex flex-col gap-1 text-sm"
      >
        <span className="font-medium text-gray-900">De</span>
        <Input
          id="history-filter-from"
          type="date"
          value={filters.from ?? ""}
          onChange={(event) => {
            updateFilters({ from: event.target.value || undefined });
          }}
        />
      </label>

      <label
        htmlFor="history-filter-to"
        className="flex flex-col gap-1 text-sm"
      >
        <span className="font-medium text-gray-900">Até</span>
        <Input
          id="history-filter-to"
          type="date"
          value={filters.to ?? ""}
          onChange={(event) => {
            updateFilters({ to: event.target.value || undefined });
          }}
        />
      </label>

      {hasActiveFilters ? (
        <Button
          type="button"
          variant="outline"
          shape="rect"
          onClick={clearFilters}
        >
          Limpar filtros
        </Button>
      ) : null}
    </div>
  );

  if (query.data.data.length === 0 && page === 1) {
    return (
      <div className="flex flex-col gap-4">
        {filtersBar}
        <EmptyState
          title={
            hasActiveFilters
              ? "Nenhuma alteração encontrada para esse filtro."
              : "Nenhuma alteração registrada ainda."
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {filtersBar}

      <ul className="flex flex-col gap-2">
        {query.data.data.map((change, index) => (
          <li
            key={`${change.created_at}-${index}`}
            className="rounded-lg border border-border px-4 py-3 text-sm"
          >
            <p className="font-medium text-gray-900">
              {EVENT_LABELS[change.event] ?? change.event}
              {change.field
                ? ` · ${FIELD_LABELS[change.field] ?? change.field}`
                : ""}
            </p>
            {change.old_value !== null || change.new_value !== null ? (
              <p className="text-gray-600">
                {change.old_value ?? "—"} → {change.new_value ?? "—"}
              </p>
            ) : null}
            <p className="text-xs text-gray-400">
              {formatDateTime(change.created_at)}
            </p>
          </li>
        ))}
      </ul>

      <Pagination
        variant="inline"
        page={page}
        hasPrevious={cursorStack.length > 0}
        hasNext={query.data.next_cursor !== null}
        onPrevious={goPrevious}
        onNext={goNext}
      />
    </div>
  );
}
