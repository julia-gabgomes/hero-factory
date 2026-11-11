import { EmptyState } from "../../../components/ui/empty-state.js";
import { ErrorState } from "../../../components/ui/error-state.js";
import { LoadingState } from "../../../components/ui/loading-state.js";
import type { MissionPage } from "../api.js";
import { MissionCard } from "./MissionCard.js";

export interface MissionListProps {
  data: MissionPage | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpenDetails: (id: string) => void;
}

export function MissionList({
  data,
  isPending,
  isError,
  onRetry,
  onOpenDetails,
}: MissionListProps) {
  if (isPending) {
    return <LoadingState label="Carregando missões…" />;
  }

  if (isError) {
    return (
      <ErrorState
        message="Não foi possível carregar as missões."
        onRetry={onRetry}
      />
    );
  }

  if (!data) {
    return null;
  }

  if (data.data.length === 0) {
    return (
      <EmptyState
        title="Nenhuma missão cadastrada"
        description="Clique em Criar para cadastrar a primeira."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.data.map((mission) => (
        <MissionCard
          key={mission.id}
          mission={mission}
          onOpenDetails={onOpenDetails}
        />
      ))}
    </div>
  );
}
