import { useState } from "react";
import { Button } from "../../../components/ui/button.js";
import { EmptyState } from "../../../components/ui/empty-state.js";
import { ErrorState } from "../../../components/ui/error-state.js";
import { LoadingState } from "../../../components/ui/loading-state.js";
import { formatDateTime } from "../../../lib/dates.js";
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

export function HeroHistoryTab({ heroId }: { heroId: string }) {
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const query = useHeroHistoryQuery(heroId, { cursor });

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

  if (query.data.data.length === 0 && cursors.length === 0) {
    return <EmptyState title="Nenhuma alteração registrada ainda." />;
  }

  return (
    <div className="flex flex-col gap-3">
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

      {query.data.next_cursor ? (
        <Button
          type="button"
          variant="outline"
          shape="rect"
          onClick={() => {
            const nextCursor = query.data.next_cursor;
            if (nextCursor) {
              setCursors((previous) => [...previous, nextCursor]);
            }
          }}
        >
          Carregar mais
        </Button>
      ) : null}
    </div>
  );
}
