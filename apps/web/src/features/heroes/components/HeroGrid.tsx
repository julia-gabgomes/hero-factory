import type { HeroResponse } from "@hero-factory/shared";
import { EmptyState } from "../../../components/ui/empty-state.js";
import { ErrorState } from "../../../components/ui/error-state.js";
import { LoadingState } from "../../../components/ui/loading-state.js";
import type { HeroPage } from "../api.js";
import { HeroCard } from "./HeroCard.js";

export interface HeroGridProps {
  data: HeroPage | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  searchTerm?: string;
  onOpenDetails: (id: string) => void;
  onEdit: (hero: HeroResponse) => void;
  onRequestDelete: (hero: HeroResponse) => void;
  onRequestToggleActive: (hero: HeroResponse) => void;
}

export function HeroGrid({
  data,
  isPending,
  isError,
  onRetry,
  searchTerm,
  onOpenDetails,
  onEdit,
  onRequestDelete,
  onRequestToggleActive,
}: HeroGridProps) {
  if (isPending) {
    return <LoadingState label="Carregando heróis…" />;
  }

  if (isError) {
    return (
      <ErrorState
        message="Não foi possível carregar os heróis."
        onRetry={onRetry}
      />
    );
  }

  if (!data) {
    return null;
  }

  if (data.data.length === 0) {
    return searchTerm ? (
      <EmptyState
        title={`Nenhum resultado para "${searchTerm}"`}
        description="Tente buscar por outro nome ou nome de guerra."
      />
    ) : (
      <EmptyState
        title="Nenhum herói cadastrado"
        description="Clique em Criar para cadastrar o primeiro."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {data.data.map((hero) => (
        <HeroCard
          key={hero.id}
          hero={hero}
          onOpenDetails={onOpenDetails}
          onEdit={onEdit}
          onRequestDelete={onRequestDelete}
          onRequestToggleActive={onRequestToggleActive}
        />
      ))}
    </div>
  );
}
