#!/usr/bin/env bash
# Teste de infraestrutura da etapa 02 (docs/specs/scaffold-monorepo/etapas/02-configurar-lint-e-formatacao.md).
# Não existe suíte Vitest para esta etapa: o comportamento verificado é a própria
# cadeia de ferramentas (ESLint flat config + typescript-eslint type-aware + Prettier),
# então o teste é este script.
#
# Para rodar: scripts/test-lint-and-format.sh
set -uo pipefail
cd "$(dirname "$0")/.."

ANY_FILE="apps/api/src/__tmp-lint-test-any.ts"
FLOATING_PROMISE_FILE="apps/api/src/__tmp-lint-test-floating-promise.ts"
UNFORMATTED_FILE="apps/api/src/__tmp-lint-test-unformatted.ts"

cleanup() {
  rm -f "$ANY_FILE" "$FLOATING_PROMISE_FILE" "$UNFORMATTED_FILE"
}
trap cleanup EXIT

FAILED=0

# Etapa 02 · C1.a — Dado o workspace com os três pacotes esqueleto (sem código
# de negócio), quando se roda `pnpm lint` na raiz, então o comando termina com
# código de saída 0 e sem nenhuma mensagem de warning ou erro na saída.
echo "== C1.a: pnpm lint termina OK e sem warnings =="
LINT_OUTPUT_BASELINE="$(pnpm lint 2>&1)"
LINT_STATUS_BASELINE=$?
if [ "$LINT_STATUS_BASELINE" -ne 0 ]; then
  echo "FALHA C1.a: pnpm lint terminou com código $LINT_STATUS_BASELINE" >&2
  echo "$LINT_OUTPUT_BASELINE" >&2
  FAILED=1
else
  if echo "$LINT_OUTPUT_BASELINE" | grep -Eiq "warning|error"; then
    echo "FALHA C1.a: pnpm lint reportou warning/error na saída" >&2
    echo "$LINT_OUTPUT_BASELINE" >&2
    FAILED=1
  else
    echo "OK C1.a"
  fi
fi

# Etapa 02 · C2.a — Dado um arquivo de teste temporário com `const x: any = 1;`
# dentro de apps/api, quando se roda `pnpm lint`, então o lint reporta erro na
# regra que proíbe `any` (@typescript-eslint/no-explicit-any). O arquivo é
# criado e removido só para esta verificação, não faz parte do código final.
echo "== C2.a: lint reporta erro de 'any' =="
cat > "$ANY_FILE" <<'EOF'
export const x: any = 1;
EOF
LINT_OUTPUT_ANY="$(pnpm lint 2>&1)"
LINT_STATUS_ANY=$?
rm -f "$ANY_FILE"
if [ "$LINT_STATUS_ANY" -eq 0 ]; then
  echo "FALHA C2.a: pnpm lint terminou com código 0 mesmo com 'any' no arquivo" >&2
  echo "$LINT_OUTPUT_ANY" >&2
  FAILED=1
elif ! echo "$LINT_OUTPUT_ANY" | grep -q "no-explicit-any"; then
  echo "FALHA C2.a: lint falhou, mas não citou a regra no-explicit-any" >&2
  echo "$LINT_OUTPUT_ANY" >&2
  FAILED=1
else
  echo "OK C2.a"
fi

# Etapa 02 · C2.b — Dado um arquivo de teste temporário com uma Promise não
# tratada (floating promise) dentro de apps/api, quando se roda `pnpm lint`,
# então o lint reporta erro na regra no-floating-promises
# (@typescript-eslint/no-floating-promises). O arquivo é criado e removido só
# para esta verificação.
echo "== C2.b: lint reporta erro de floating promise =="
cat > "$FLOATING_PROMISE_FILE" <<'EOF'
async function doSomethingAsync(): Promise<void> {
  return Promise.resolve();
}

export function triggerFloatingPromise(): void {
  doSomethingAsync();
}
EOF
LINT_OUTPUT_FP="$(pnpm lint 2>&1)"
LINT_STATUS_FP=$?
rm -f "$FLOATING_PROMISE_FILE"
if [ "$LINT_STATUS_FP" -eq 0 ]; then
  echo "FALHA C2.b: pnpm lint terminou com código 0 mesmo com floating promise no arquivo" >&2
  echo "$LINT_OUTPUT_FP" >&2
  FAILED=1
elif ! echo "$LINT_OUTPUT_FP" | grep -q "no-floating-promises"; then
  echo "FALHA C2.b: lint falhou, mas não citou a regra no-floating-promises" >&2
  echo "$LINT_OUTPUT_FP" >&2
  FAILED=1
else
  echo "OK C2.b"
fi

# Etapa 02 · C3.a — Dado um arquivo com formatação fora do padrão do Prettier
# (aspas simples e indentação de 2 espaços deliberadamente diferentes do
# esperado), quando se roda `pnpm format`, então o arquivo passa a seguir o
# estilo do Prettier (aspas duplas) e `pnpm lint` continua passando sem erro
# depois da formatação.
echo "== C3.a: pnpm format normaliza o estilo e lint continua OK =="
printf "export const unformatted = {\n    a: 'um',\n      b: 'dois',\n};\n" > "$UNFORMATTED_FILE"
pnpm format >/dev/null 2>&1
FORMATTED_CONTENT="$(cat "$UNFORMATTED_FILE")"
if ! echo "$FORMATTED_CONTENT" | grep -q '"um"'; then
  echo "FALHA C3.a: pnpm format não normalizou as aspas para o padrão do Prettier" >&2
  echo "$FORMATTED_CONTENT" >&2
  FAILED=1
  rm -f "$UNFORMATTED_FILE"
else
  LINT_OUTPUT_AFTER_FORMAT="$(pnpm lint 2>&1)"
  LINT_STATUS_AFTER_FORMAT=$?
  rm -f "$UNFORMATTED_FILE"
  if [ "$LINT_STATUS_AFTER_FORMAT" -ne 0 ]; then
    echo "FALHA C3.a: pnpm lint falhou depois de pnpm format" >&2
    echo "$LINT_OUTPUT_AFTER_FORMAT" >&2
    FAILED=1
  else
    echo "OK C3.a"
  fi
fi

exit "$FAILED"
