import { AlertTriangle } from "lucide-react";
import { Button } from "./button.js";

export function ErrorState({
  message = "Não foi possível carregar os dados.",
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-gray-600">
      <AlertTriangle className="size-8 text-danger" aria-hidden="true" />
      <p>{message}</p>
      <Button variant="outline" shape="rect" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}
