import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn.js";

export interface PaginationProps {
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

// Cursor opaco por baixo: só dá pra andar uma página por vez (não existe
// "pular pra página N"). O número da próxima página é só um atalho visual
// para "próxima", não um link direto.
export function Pagination({
  page,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: PaginationProps) {
  return (
    <nav
      aria-label="Paginação"
      className="fixed bottom-6 right-6 z-20 flex items-center gap-1.5 rounded-full bg-white px-2 py-1.5 shadow-md"
    >
      <button
        type="button"
        aria-label="Página anterior"
        disabled={!hasPrevious}
        onClick={onPrevious}
        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>

      <span
        aria-current="page"
        className="flex size-8 items-center justify-center rounded-md bg-primary-soft text-sm font-medium text-primary"
      >
        {page}
      </span>

      {hasNext ? (
        <button
          type="button"
          aria-label={`Ir para a página ${String(page + 1)}`}
          onClick={onNext}
          className={cn(
            "flex size-8 items-center justify-center rounded-md bg-gray-100 text-sm font-medium text-gray-500 hover:bg-gray-200",
          )}
        >
          {page + 1}
        </button>
      ) : null}

      <button
        type="button"
        aria-label="Próxima página"
        disabled={!hasNext}
        onClick={onNext}
        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </nav>
  );
}
