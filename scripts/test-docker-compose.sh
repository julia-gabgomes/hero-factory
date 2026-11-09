#!/usr/bin/env bash
# Teste de infraestrutura da etapa 03 (docs/specs/scaffold-monorepo/etapas/03-criar-docker-compose-e-env.md).
# Não existe suíte Vitest para esta etapa: o comportamento verificado é a
# subida real dos serviços via Docker Compose, então o teste é este script.
# Exige Docker e Docker Compose v2 (`docker compose`) disponíveis na máquina.
#
# Para rodar: scripts/test-docker-compose.sh
set -uo pipefail
cd "$(dirname "$0")/.."

FAILED=0
HEALTHCHECK_TIMEOUT_SECONDS=60

cleanup() {
  echo "== limpeza: docker compose down =="
  docker compose down >/dev/null 2>&1
}
trap cleanup EXIT

# Etapa 03 · C1.a — Dado o docker-compose.yml criado, quando se roda
# `docker compose config`, então o comando termina com código de saída 0 e
# imprime a configuração resolvida sem avisos de variável ambiente ausente
# (mensagem "variable is not set" não aparece na saída).
echo "== C1.a: docker compose config valida sem erro e sem variável ausente =="
CONFIG_OUTPUT="$(docker compose config 2>&1)"
CONFIG_STATUS=$?
if [ "$CONFIG_STATUS" -ne 0 ]; then
  echo "FALHA C1.a: docker compose config terminou com código $CONFIG_STATUS" >&2
  echo "$CONFIG_OUTPUT" >&2
  FAILED=1
elif echo "$CONFIG_OUTPUT" | grep -qi "variable is not set"; then
  echo "FALHA C1.a: docker compose config reportou variável de ambiente ausente" >&2
  echo "$CONFIG_OUTPUT" >&2
  FAILED=1
else
  echo "OK C1.a"
fi

# Etapa 03 · C3.a — Dado o compose criado, quando se roda
# `docker compose up -d mysql` e se espera (com timeout) o healthcheck do
# MySQL, então `docker compose ps` passa a mostrar o serviço `mysql` com
# status "healthy".
echo "== C3.a: mysql sobe e fica \"healthy\" =="
UP_MYSQL_OUTPUT="$(docker compose up -d mysql 2>&1)"
UP_MYSQL_STATUS=$?
if [ "$UP_MYSQL_STATUS" -ne 0 ]; then
  echo "FALHA C3.a: docker compose up -d mysql terminou com código $UP_MYSQL_STATUS" >&2
  echo "$UP_MYSQL_OUTPUT" >&2
  FAILED=1
else
  MYSQL_HEALTHY=0
  ELAPSED=0
  while [ "$ELAPSED" -lt "$HEALTHCHECK_TIMEOUT_SECONDS" ]; do
    STATUS_LINE="$(docker compose ps mysql 2>&1)"
    if echo "$STATUS_LINE" | grep -qi "healthy"; then
      MYSQL_HEALTHY=1
      break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
  done

  if [ "$MYSQL_HEALTHY" -ne 1 ]; then
    echo "FALHA C3.a: serviço mysql não ficou \"healthy\" em até ${HEALTHCHECK_TIMEOUT_SECONDS}s" >&2
    docker compose ps mysql >&2 2>&1
    FAILED=1
  else
    echo "OK C3.a"
  fi
fi

# Etapa 03 · C3.b — Dado o MySQL saudável, quando se consulta a variável
# `collation_server` do servidor via
# `SHOW VARIABLES LIKE 'collation_server'`, então o valor retornado é
# `utf8mb4_0900_ai_ci`.
echo "== C3.b: collation_server é utf8mb4_0900_ai_ci =="
if [ "$FAILED" -eq 1 ]; then
  echo "PULADO C3.b: depende do mysql estar \"healthy\" (ver falha de C3.a)" >&2
else
  MYSQL_ROOT_PASSWORD_FOR_TEST="${MYSQL_ROOT_PASSWORD:-}"
  if [ -z "$MYSQL_ROOT_PASSWORD_FOR_TEST" ] && [ -f .env.example ]; then
    MYSQL_ROOT_PASSWORD_FOR_TEST="$(grep -E '^MYSQL_ROOT_PASSWORD=' .env.example | head -n1 | cut -d'=' -f2-)"
  fi

  COLLATION_OUTPUT="$(docker compose exec -T mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD_FOR_TEST" -e "SHOW VARIABLES LIKE 'collation_server';" 2>&1)"
  COLLATION_STATUS=$?
  if [ "$COLLATION_STATUS" -ne 0 ]; then
    echo "FALHA C3.b: consulta ao mysql terminou com código $COLLATION_STATUS" >&2
    echo "$COLLATION_OUTPUT" >&2
    FAILED=1
  elif ! echo "$COLLATION_OUTPUT" | grep -q "utf8mb4_0900_ai_ci"; then
    echo "FALHA C3.b: collation_server não é utf8mb4_0900_ai_ci" >&2
    echo "$COLLATION_OUTPUT" >&2
    FAILED=1
  else
    echo "OK C3.b"
  fi
fi

# Etapa 03 · C5.a — Dado o compose criado, quando se roda
# `docker compose up -d migrate api1 api2 worker` (placeholders), então os
# quatro serviços sobem sem erro de build/start e, alguns segundos depois,
# continuam em execução (não aparecem como "Exited" em `docker compose ps`).
echo "== C5.a: migrate, api1, api2 e worker sobem e permanecem de pé =="
UP_APPS_OUTPUT="$(docker compose up -d migrate api1 api2 worker 2>&1)"
UP_APPS_STATUS=$?
if [ "$UP_APPS_STATUS" -ne 0 ]; then
  echo "FALHA C5.a: docker compose up -d migrate api1 api2 worker terminou com código $UP_APPS_STATUS" >&2
  echo "$UP_APPS_OUTPUT" >&2
  FAILED=1
else
  sleep 5
  APPS_PS_OUTPUT="$(docker compose ps migrate api1 api2 worker 2>&1)"
  APPS_FAILED=0
  for SERVICE in migrate api1 api2 worker; do
    if ! echo "$APPS_PS_OUTPUT" | grep -q "$SERVICE"; then
      echo "FALHA C5.a: serviço $SERVICE não aparece em docker compose ps" >&2
      APPS_FAILED=1
      continue
    fi
    if echo "$APPS_PS_OUTPUT" | grep "$SERVICE" | grep -qi "exit"; then
      echo "FALHA C5.a: serviço $SERVICE saiu (Exited) em vez de continuar rodando" >&2
      APPS_FAILED=1
    fi
  done
  if [ "$APPS_FAILED" -eq 1 ]; then
    echo "$APPS_PS_OUTPUT" >&2
    FAILED=1
  else
    echo "OK C5.a"
  fi
fi

exit "$FAILED"
