import { useState } from "react";
import {
  listMissionsQuerySchema,
  type MissionStatus,
} from "@hero-factory/shared";
import { Plus } from "lucide-react";
import { z } from "zod";
import { Button } from "../../../components/ui/button.js";
import { Pagination } from "../../../components/ui/pagination.js";
import { useTypedSearch } from "../../../lib/use-typed-search.js";
import { useMissionsQuery } from "../api.js";
import { MissionDetailsDialog } from "../components/MissionDetailsDialog.js";
import { MissionFormDialog } from "../components/MissionFormDialog.js";
import { MissionList } from "../components/MissionList.js";
import { MissionStatusFilter } from "../components/MissionStatusFilter.js";

const pageSearchSchema = listMissionsQuerySchema.extend({
  mission: z.string().optional(),
});

export function MissionsPage() {
  const [search, setSearch] = useTypedSearch(pageSearchSchema);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const page = cursorStack.length + 1;
  const [isCreateOpen, setCreateOpen] = useState(false);

  const missionsQuery = useMissionsQuery({
    cursor: search.cursor,
    status: search.status,
  });

  function runStatusChange(next: MissionStatus[]) {
    setSearch({ status: next, cursor: undefined });
    setCursorStack([]);
  }

  function goNext() {
    const nextCursor = missionsQuery.data?.next_cursor;
    if (!nextCursor) return;
    setCursorStack((previous) => [...previous, nextCursor]);
    setSearch({ cursor: nextCursor });
  }

  function goPrevious() {
    const newStack = cursorStack.slice(0, -1);
    setCursorStack(newStack);
    setSearch({ cursor: newStack.at(-1) });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-4xl font-bold text-primary">Missões</h1>

      <div>
        <Button
          shape="pill"
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          Criar
        </Button>
      </div>

      <MissionStatusFilter
        value={search.status ?? []}
        onChange={runStatusChange}
      />

      <MissionList
        data={missionsQuery.data}
        isPending={missionsQuery.isPending}
        isError={missionsQuery.isError}
        onRetry={() => void missionsQuery.refetch()}
        onOpenDetails={(id) => {
          setSearch({ mission: id });
        }}
      />

      {missionsQuery.data && missionsQuery.data.data.length > 0 ? (
        <Pagination
          page={page}
          hasPrevious={cursorStack.length > 0}
          hasNext={missionsQuery.data.next_cursor !== null}
          onPrevious={goPrevious}
          onNext={goNext}
        />
      ) : null}

      <MissionFormDialog open={isCreateOpen} onOpenChange={setCreateOpen} />

      <MissionDetailsDialog
        missionId={search.mission}
        open={search.mission !== undefined}
        onOpenChange={(open) => {
          if (!open) setSearch({ mission: undefined });
        }}
      />
    </div>
  );
}
