import { useState } from "react";
import { Button } from "../../../components/ui/button.js";
import { EmptyState } from "../../../components/ui/empty-state.js";
import { ErrorState } from "../../../components/ui/error-state.js";
import { LoadingState } from "../../../components/ui/loading-state.js";
import { formatDateTime } from "../../../lib/dates.js";
import { MissionStatusBadge } from "../../missions/components/MissionStatusBadge.js";
import { useHeroMissionsQuery } from "../api.js";

export function HeroMissionsTab({ heroId }: { heroId: string }) {
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const query = useHeroMissionsQuery(heroId, { cursor });

  if (query.isPending) {
    return <LoadingState label="Carregando missões…" />;
  }

  if (query.isError) {
    return (
      <ErrorState
        message="Não foi possível carregar as missões."
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (query.data.data.length === 0 && cursors.length === 0) {
    return <EmptyState title="Este herói ainda não participou de missões." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {query.data.data.map((mission) => (
          <li
            key={mission.id}
            className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium text-gray-900">{mission.title}</p>
              <p className="text-xs text-gray-400">
                {formatDateTime(mission.starts_at)} –{" "}
                {formatDateTime(mission.ends_at)}
              </p>
            </div>
            <MissionStatusBadge status={mission.status} />
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
