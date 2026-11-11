import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { EmptyState } from "../../../components/ui/empty-state.js";
import { ErrorState } from "../../../components/ui/error-state.js";
import { LoadingState } from "../../../components/ui/loading-state.js";
import { Pagination } from "../../../components/ui/pagination.js";
import { dateTimeLocalToIsoUtc, formatDateTime } from "../../../lib/dates.js";
import { useHeroHistoryQuery } from "../api.js";
import {
  EVENT_LABELS,
  FIELD_LABELS,
  HISTORY_EVENT_TONES,
  formatHistoryValue,
} from "../hero-history-labels.js";
import { HeroHistoryFieldFilter } from "./HeroHistoryFieldFilter.js";
import { HeroHistoryPeriodFilter } from "./HeroHistoryPeriodFilter.js";

interface HistoryFilters {
  field?: string;
  from?: string;
  to?: string;
  periodLabel?: string;
}

export function HeroHistoryTab({ heroId }: { heroId: string }) {
  const [filters, setFilters] = useState<HistoryFilters>({});
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const page = cursorStack.length + 1;
  const hasActiveFilters =
    filters.field !== undefined || filters.from !== undefined;

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

  const { total, field_totals } = query.data;
  const filteredTotal =
    filters.field !== undefined
      ? (field_totals[filters.field] ?? 0)
      : Object.values(field_totals).reduce((sum, count) => sum + count, 0);

  const filtersBar = (
    <div className="flex flex-col gap-4 rounded-2xl bg-gray-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-gray-400">
          FILTRAR POR
        </p>
        <HeroHistoryPeriodFilter
          from={filters.from}
          to={filters.to}
          presetLabel={filters.periodLabel}
          onApply={(from, to, periodLabel) => {
            updateFilters({ from, to, periodLabel });
          }}
          onClear={() => {
            updateFilters({ from: undefined, to: undefined, periodLabel: undefined });
          }}
        />
      </div>

      <HeroHistoryFieldFilter
        value={filters.field}
        counts={field_totals}
        onChange={(field) => {
          updateFilters({ field });
        }}
      />
    </div>
  );

  const summaryBar = (
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-600">
        <span className="font-bold text-gray-900">{filteredTotal}</span>{" "}
        {filteredTotal === total
          ? "alterações"
          : `alterações de ${String(total)}`}
      </p>
      {hasActiveFilters ? (
        <button
          type="button"
          onClick={clearFilters}
          className="text-sm font-medium text-primary hover:underline"
        >
          Limpar filtros
        </button>
      ) : null}
    </div>
  );

  if (query.data.data.length === 0 && page === 1) {
    return (
      <div className="flex flex-col gap-4">
        {filtersBar}
        {summaryBar}
        <EmptyState
          title={
            hasActiveFilters
              ? "Nenhuma alteração encontrada"
              : "Nenhuma alteração registrada ainda."
          }
          description={
            hasActiveFilters ? (
              <div className="flex flex-col items-center gap-3">
                <p>Tente outro campo ou amplie o período selecionado.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-md bg-primary-soft px-4 py-2 text-sm font-medium text-primary"
                >
                  Limpar filtros
                </button>
              </div>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {filtersBar}
      {summaryBar}

      <ul className="flex flex-col gap-2">
        {query.data.data.map((change, index) => (
          <li
            key={`${change.created_at}-${index}`}
            className="rounded-2xl border border-border px-5 py-4 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="flex items-center gap-2">
                <Badge tone={HISTORY_EVENT_TONES[change.event]}>
                  {EVENT_LABELS[change.event]}
                </Badge>
                {change.field ? (
                  <span className="whitespace-nowrap font-bold text-gray-900">
                    {FIELD_LABELS[change.field] ?? change.field}
                  </span>
                ) : null}
              </div>
              <span className="shrink-0 text-xs text-gray-400">
                {formatDateTime(change.created_at)}
              </span>
            </div>
            {change.old_value !== null || change.new_value !== null ? (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-700">
                <span className="text-gray-400 line-through">
                  {formatHistoryValue(change.field, change.old_value) ?? "—"}
                </span>
                <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                <span className="font-medium text-gray-900">
                  {formatHistoryValue(change.field, change.new_value) ?? "—"}
                </span>
              </p>
            ) : null}
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
