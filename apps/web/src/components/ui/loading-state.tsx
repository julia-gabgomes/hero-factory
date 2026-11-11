import { Loader2 } from "lucide-react";

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500"
    >
      <Loader2 className="size-8 animate-spin" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}
