#!/usr/bin/env bash
# Teste de infraestrutura da etapa 04 (docs/specs/scaffold-monorepo/etapas/04-criar-nginx-e-ligar-ao-compose.md).
# Não existe suíte Vitest para esta etapa: o comportamento verificado é a
# validade do nginx.conf e a subida real do serviço nginx via Docker Compose,
# então o teste é este script.
# Exige Docker e Docker Compose v2 (`docker compose`) disponíveis na máquina.
#
# Para rodar: scripts/test-nginx.sh
set -uo pipefail
cd "$(dirname "$0")/.."

FAILED=0
UP_TIMEOUT_SECONDS=30

cleanup() {
  echo "== limpeza: docker compose down =="
  docker compose down >/dev/null 2>&1
}
trap cleanup EXIT

# Etapa 04 · C3.a — Dado o nginx.conf criado, quando se roda `nginx -t` dentro
# de um container oficial `nginx:stable-alpine` com o nginx.conf montado no
# lugar do arquivo de configuração padrão, então o comando confirma que a
# sintaxe está correta (código de saída 0 e mensagem "syntax is ok" / "test is
# successful"), sem erro.
echo "== C3.a: nginx -t confirma sintaxe válida de nginx/nginx.conf =="
if [ ! -f nginx/nginx.conf ]; then
  echo "FALHA C3.a: nginx/nginx.conf não existe" >&2
  FAILED=1
else
  NGINX_T_OUTPUT="$(docker run --rm \
    -v "$(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
    nginx:stable-alpine nginx -t 2>&1)"
  NGINX_T_STATUS=$?
  if [ "$NGINX_T_STATUS" -ne 0 ]; then
    echo "FALHA C3.a: nginx -t terminou com código $NGINX_T_STATUS" >&2
    echo "$NGINX_T_OUTPUT" >&2
    FAILED=1
  elif ! echo "$NGINX_T_OUTPUT" | grep -qi "syntax is ok"; then
    echo "FALHA C3.a: nginx -t não confirmou \"syntax is ok\"" >&2
    echo "$NGINX_T_OUTPUT" >&2
    FAILED=1
  else
    echo "OK C3.a"
  fi
fi

# Etapa 04 · C4.a — Dado o compose com os serviços api1/api2 (placeholders) e
# nginx declarados, quando se roda `docker compose up -d api1 api2 nginx`,
# então o serviço nginx sobe, fica de pé (não aparece como "Exited"), e uma
# requisição HTTP a `http://localhost/` responde com status 200 e corpo HTML
# (o stub de SPA).
echo "== C4.a: nginx sobe e serve o stub de SPA em http://localhost/ =="
UP_OUTPUT="$(docker compose up -d api1 api2 nginx 2>&1)"
UP_STATUS=$?
if [ "$UP_STATUS" -ne 0 ]; then
  echo "FALHA C4.a: docker compose up -d api1 api2 nginx terminou com código $UP_STATUS" >&2
  echo "$UP_OUTPUT" >&2
  FAILED=1
else
  NGINX_UP=0
  ELAPSED=0
  while [ "$ELAPSED" -lt "$UP_TIMEOUT_SECONDS" ]; do
    PS_OUTPUT="$(docker compose ps nginx 2>&1)"
    if echo "$PS_OUTPUT" | grep -qi "exit"; then
      break
    fi
    if echo "$PS_OUTPUT" | grep -q "nginx"; then
      HTTP_STATUS="$(curl -s -o /tmp/hero-factory-nginx-body.html -w '%{http_code}' http://localhost/ 2>/dev/null || true)"
      if [ "$HTTP_STATUS" = "200" ]; then
        NGINX_UP=1
        break
      fi
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
  done

  if [ "$NGINX_UP" -ne 1 ]; then
    echo "FALHA C4.a: nginx não respondeu 200 em http://localhost/ em até ${UP_TIMEOUT_SECONDS}s" >&2
    docker compose ps nginx >&2 2>&1
    FAILED=1
  elif ! grep -qi "<html" /tmp/hero-factory-nginx-body.html 2>/dev/null; then
    echo "FALHA C4.a: corpo da resposta de http://localhost/ não parece HTML" >&2
    cat /tmp/hero-factory-nginx-body.html >&2 2>/dev/null
    FAILED=1
  else
    echo "OK C4.a"
  fi
  rm -f /tmp/hero-factory-nginx-body.html
fi

exit "$FAILED"
