#!/usr/bin/env bash
# Teste de infraestrutura da etapa 01 (docs/specs/scaffold-monorepo/etapas/01-criar-workspace-e-pacotes.md).
# Não existe suíte Vitest para esta etapa: o comportamento verificado é a própria
# cadeia de ferramentas (workspace pnpm + typecheck), então o teste é este script.
#
# Para rodar: scripts/test-workspace-install-and-typecheck.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# Etapa 01 · C1.a — Dado um clone novo do repositório (sem node_modules em
# lugar nenhum), quando se roda `pnpm install` na raiz, então a instalação
# termina com código de saída 0 e cria node_modules nos três pacotes do
# workspace (packages/shared, apps/api, apps/web), além do node_modules raiz.
echo "== C1.a: pnpm install =="
pnpm install

test -e node_modules || {
  echo "FALHA C1.a: node_modules não foi criado na raiz" >&2
  exit 1
}
for pkg in packages/shared apps/api apps/web; do
  test -e "$pkg/node_modules" || {
    echo "FALHA C1.a: node_modules não foi criado em $pkg" >&2
    exit 1
  }
done
echo "OK C1.a"

# Etapa 01 · C4.a — Dado o workspace instalado, quando se roda `pnpm typecheck`
# na raiz, então o comando termina com código de saída 0 para os três pacotes
# (packages/shared, apps/api, apps/web), sem nenhum erro de tipo.
echo "== C4.a: pnpm typecheck =="
pnpm typecheck
echo "OK C4.a"
