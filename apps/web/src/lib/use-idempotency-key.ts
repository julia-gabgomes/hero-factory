import { useState } from "react";

// Gera a chave quando o modal abre e reusa em todas as tentativas de Salvar.
// Só gera outra depois do sucesso (resetIdempotencyKey) ou quando o modal
// fecha e abre de novo (open vira true de novo).
//
// Ajusta o estado durante a renderização (comparando com o `open` anterior),
// em vez de um useEffect: é o padrão recomendado para "reagir a uma prop
// mudando", sem o atraso de um efeito.
export function useIdempotencyKey(open: boolean): {
  idempotencyKey: string;
  resetIdempotencyKey: () => void;
} {
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [previousOpen, setPreviousOpen] = useState(open);

  if (open !== previousOpen) {
    setPreviousOpen(open);
    if (open) {
      setIdempotencyKey(crypto.randomUUID());
    }
  }

  return {
    idempotencyKey,
    resetIdempotencyKey: () => {
      setIdempotencyKey(crypto.randomUUID());
    },
  };
}
