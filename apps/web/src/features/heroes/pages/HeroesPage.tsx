import { useState } from "react";
import type { HeroResponse } from "@hero-factory/shared";
import { listHeroesQuerySchema } from "@hero-factory/shared";
import { Plus, Search } from "lucide-react";
import { z } from "zod";
import { ConfirmDialog } from "../../../components/ui/alert-dialog.js";
import { Button } from "../../../components/ui/button.js";
import { Input } from "../../../components/ui/input.js";
import { Pagination } from "../../../components/ui/pagination.js";
import { useTypedSearch } from "../../../lib/use-typed-search.js";
import {
  useActivateHero,
  useDeactivateHero,
  useDeleteHero,
  useHeroesQuery,
} from "../api.js";
import { HeroDetailsDialog } from "../components/HeroDetailsDialog.js";
import { HeroFormDialog } from "../components/HeroFormDialog.js";
import { HeroGrid } from "../components/HeroGrid.js";

const pageSearchSchema = listHeroesQuerySchema.extend({
  hero: z.string().optional(),
});

export function HeroesPage() {
  const [search, setSearch] = useTypedSearch(pageSearchSchema);
  const [searchDraft, setSearchDraft] = useState(search.q ?? "");

  // O backend hoje nunca devolve prev_cursor (sempre null), então "voltar"
  // depende de lembrarmos localmente os cursores já visitados nesta sessão
  // de navegação, não de um cursor reverso vindo da API.
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const page = cursorStack.length + 1;

  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingHero, setEditingHero] = useState<HeroResponse | null>(null);
  const [pendingDelete, setPendingDelete] = useState<HeroResponse | null>(null);
  const [pendingToggle, setPendingToggle] = useState<HeroResponse | null>(null);

  const heroesQuery = useHeroesQuery({ q: search.q, cursor: search.cursor });
  const deleteHero = useDeleteHero();
  const activateHero = useActivateHero();
  const deactivateHero = useDeactivateHero();

  function runSearch(term: string) {
    setSearch({ q: term.trim() || undefined, cursor: undefined });
    setCursorStack([]);
  }

  function goNext() {
    const nextCursor = heroesQuery.data?.next_cursor;
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
      <h1 className="text-center text-4xl font-bold text-primary">Heróis</h1>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          shape="pill"
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          Criar
        </Button>

        <form
          role="search"
          className="flex flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            runSearch(searchDraft);
          }}
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <Input
              type="search"
              variant="bare"
              className="pl-10"
              placeholder="Digite o nome do herói"
              aria-label="Buscar herói por nome ou nome de guerra"
              value={searchDraft}
              onChange={(event) => {
                setSearchDraft(event.target.value);
              }}
            />
          </div>
          <Button type="submit" variant="outline" shape="pill">
            Buscar
          </Button>
        </form>
      </div>

      <HeroGrid
        data={heroesQuery.data}
        isPending={heroesQuery.isPending}
        isError={heroesQuery.isError}
        onRetry={() => void heroesQuery.refetch()}
        searchTerm={search.q}
        onOpenDetails={(id) => {
          setSearch({ hero: id });
        }}
        onEdit={setEditingHero}
        onRequestDelete={setPendingDelete}
        onRequestToggleActive={setPendingToggle}
      />

      {heroesQuery.data && heroesQuery.data.data.length > 0 ? (
        <Pagination
          page={page}
          hasPrevious={cursorStack.length > 0}
          hasNext={heroesQuery.data.next_cursor !== null}
          onPrevious={goPrevious}
          onNext={goNext}
        />
      ) : null}

      <HeroFormDialog open={isCreateOpen} onOpenChange={setCreateOpen} />

      <HeroFormDialog
        open={editingHero !== null}
        onOpenChange={(open) => {
          if (!open) setEditingHero(null);
        }}
        hero={editingHero ?? undefined}
      />

      <HeroDetailsDialog
        heroId={search.hero}
        open={search.hero !== undefined}
        onOpenChange={(open) => {
          if (!open) setSearch({ hero: undefined });
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Excluir herói"
        description={`Excluir ${pendingDelete?.nickname ?? ""}? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        confirmVariant="solid"
        isConfirming={deleteHero.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteHero.mutate(
            { id: pendingDelete.id, version: pendingDelete.version },
            { onSettled: () => setPendingDelete(null) },
          );
        }}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
        title={pendingToggle?.is_active ? "Inativar herói" : "Ativar herói"}
        description={
          pendingToggle?.is_active
            ? `Inativar ${pendingToggle.nickname}? Ele não poderá ser escalado em missões.`
            : `Ativar ${pendingToggle?.nickname ?? ""}? Ele voltará a poder ser escalado em missões.`
        }
        confirmLabel={pendingToggle?.is_active ? "Inativar" : "Ativar"}
        isConfirming={activateHero.isPending || deactivateHero.isPending}
        onConfirm={() => {
          if (!pendingToggle) return;
          const mutation = pendingToggle.is_active
            ? deactivateHero
            : activateHero;
          mutation.mutate(
            { id: pendingToggle.id, version: pendingToggle.version },
            { onSettled: () => setPendingToggle(null) },
          );
        }}
      />
    </div>
  );
}
