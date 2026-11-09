# 04 — Criar o nginx.conf v1 e ligá-lo ao compose

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** 03 (precisa dos serviços `api1`/`api2` já declarados no compose para apontar o upstream)

## Execução

**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega

O projeto passa a ter um `nginx` servindo como ponto de entrada único: faz round-robin de `/api` entre `api1` e `api2`, e serve um stub de SPA em `/`. O serviço `nginx` entra no `docker-compose.yml`, completando a topologia descrita no `CLAUDE.md`.

## Critérios de aceite

- [x] C1 — `nginx/nginx.conf` declara um upstream com round-robin entre `api1` e `api2` para o caminho `/api`.
- [x] C2 — `nginx/nginx.conf` serve um stub de SPA (qualquer HTML estático mínimo) no caminho `/`.
- [x] C3 — A configuração do nginx é válida (`nginx -t` não reporta erro).
- [x] C4 — O serviço `nginx` está declarado no `docker-compose.yml`, expõe a porta 80 e depende de `api1` e `api2` estarem de pé.

## Cenários de teste

- **C1.a (verificação manual)** — Dado o `nginx.conf` aberto, quando se olha o bloco `upstream` usado por `/api`, então ele lista `api1` e `api2` como servidores, sem política explícita de peso (round-robin é o padrão do nginx).
- **C2.a (verificação manual)** — Dado o `nginx.conf` aberto, quando se olha o bloco `location /`, então ele serve arquivos estáticos de um diretório com um `index.html` stub.
- **C3.a** — Dado o `nginx.conf` criado, quando se roda `nginx -t -c nginx/nginx.conf` (ou o equivalente dentro do container), então o comando confirma que a sintaxe está correta, sem erro.
- **C4.a** — Dado o compose com os placeholders de `api1`/`api2` de pé, quando se roda `docker compose up -d nginx`, então o serviço `nginx` sobe, fica de pé, e uma requisição a `http://localhost/` responde com o stub de SPA (status 200).

## Fora desta etapa

- Round-robin real validado contra respostas diferentes de `api1`/`api2` (eles ainda são placeholders sem rota `/api` real) — a validação nesta etapa é de configuração e de a requisição chegar a algum upstream, não de alternância observável.
- Servir `/uploads/*` do volume compartilhado — entra quando a feature de avatar/CSV existir.

## Registro da implementação
**Testes**
- `scripts/test-nginx.sh` — cenários C3.a, C4.a

**O que foi alterado**
- O `nginx` passa a ser o ponto de entrada único declarado no compose: serve o stub da SPA (`nginx/html/index.html`) em `/` e repassa `/api` em round-robin entre `api1` e `api2`.

**Desvios do planejado**
- O upstream usa resolução dinâmica (`resolver 127.0.0.11` + `zone` + parâmetro `resolve` nos `server`) em vez de hostnames estáticos. Com hostnames estáticos, `nginx -t` falha fora da rede do compose (o teste C3.a roda o `nginx -t` num container isolado, sem os serviços `api1`/`api2` resolvíveis), então a resolução precisa ser adiada para o momento da requisição, não da carga da configuração. O comportamento de round-robin entre `api1` e `api2` continua o mesmo quando o nginx roda dentro do compose. Confirmado na revisão: não é gambiarra — `127.0.0.11` é o DNS embutido do Docker, e é a forma documentada de lidar com upstream dinâmico quando containers podem trocar de IP.

**Sugestões da revisão**
- `nginx/nginx.conf` — adicionar `server_tokens off;` no bloco `http` para não expor a versão exata do nginx no header `Server` e em páginas de erro; vale revisitar quando a config v2 (produção) for escrita.
