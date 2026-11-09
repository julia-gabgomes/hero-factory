# 03 — Criar o docker-compose v1 e o .env.example

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** 01 (os placeholders de `migrate`/`api1`/`api2`/`worker` referenciam os diretórios de `apps/api`)

## Execução

**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega

O projeto passa a subir um MySQL 8.4 real e saudável via Docker Compose, com a topologia completa declarada (`mysql` → `migrate` → `api1`/`api2`/`worker`), mesmo que os serviços de aplicação ainda sejam placeholders que só ficam de pé. As variáveis de ambiente usadas pelo compose ficam documentadas em `.env.example`.

## Critérios de aceite

- [x] C1 — `docker compose config` valida o `docker-compose.yml` sem erro.
- [ ] C2 — O compose declara a ordem de dependência de subida `mysql (healthcheck) → migrate → api1/api2/worker`.
- [x] C3 — `docker compose up -d mysql` sobe o serviço `mysql` na versão 8.4, com collation padrão `utf8mb4_0900_ai_ci`, e o healthcheck fica saudável.
- [ ] C4 — `.env.example` existe e cobre todas as variáveis referenciadas pelo `docker-compose.yml` (ex.: credenciais do MySQL, `SEED_ON_START`).
- [x] C5 — Os serviços `migrate`, `api1`, `api2` e `worker` estão declarados no compose como placeholders (sobem e ficam de pé, sem lógica real).

## Cenários de teste

- **C1.a** — Dado o `docker-compose.yml` criado, quando se roda `docker compose config`, então o comando termina com código de saída 0 e imprime a configuração resolvida sem avisos de variável ausente.
- **C2.a (verificação manual)** — Dado o `docker-compose.yml` aberto, quando se olha os campos `depends_on` de `migrate`, `api1`, `api2` e `worker`, então todos dependem de `mysql` com `condition: service_healthy`.
- **C3.a** — Dado o compose criado, quando se roda `docker compose up -d mysql` e se espera o healthcheck, então `docker compose ps` mostra o serviço `mysql` com status "healthy".
- **C3.b** — Dado o MySQL saudável, quando se consulta a collation padrão do servidor (ex.: `SHOW VARIABLES LIKE 'collation_server'`), então o valor é `utf8mb4_0900_ai_ci`.
- **C4.a (verificação manual)** — Dado o `.env.example` aberto ao lado do `docker-compose.yml`, quando se compara cada variável `${VAR}` usada no compose, então todas aparecem no `.env.example` com um valor de exemplo.
- **C5.a** — Dado o compose criado, quando se roda `docker compose up -d migrate api1 api2 worker` (sem erro de build/start), então os quatro serviços sobem e permanecem de pé (não encerram imediatamente com erro).

## Valores provisórios

- Placeholders de `migrate`, `api1`, `api2` e `worker` (ex.: imagem Node oficial rodando um comando mínimo que mantém o processo vivo, como `tail -f /dev/null`, ou um `Dockerfile` que só copia o pacote e faz `sleep infinity`) — serão substituídos pelos Dockerfiles e comandos reais quando a API e o worker forem implementados.

## Fora desta etapa

- `nginx` como serviço do compose — entra na etapa 04, que cria o `nginx.conf` junto.
- Lógica real de migration, seed ou da API — fora do escopo desta tarefa de scaffold.

## Registro da implementação
**Testes**
- `scripts/test-docker-compose.sh` — cenários C1.a, C3.a, C3.b, C5.a

**O que foi alterado**
- O `docker-compose.yml` da raiz passou a existir, com o serviço `mysql` (imagem `mysql:8.4`, collation `utf8mb4_0900_ai_ci` via flags de `command`, volume nomeado `mysql_data` para persistir os dados entre subidas, e healthcheck real via `mysqladmin ping`) e os placeholders `migrate`, `api1`, `api2` e `worker` (imagem `node:24`, comando `tail -f /dev/null` só para existir e ficar "Up").
- O `.env.example` da raiz passou a documentar as credenciais do MySQL, a versão do Node usada pelos placeholders e `SEED_ON_START` (ainda não lido por nenhum serviço real).

**Desvios do planejado**
- `migrate`, `api1`, `api2` e `worker` dependem só de `mysql: condition: service_healthy`, e não de `migrate` terminar. Como `migrate` ainda é um placeholder que nunca termina (`tail -f /dev/null`), uma dependência do tipo `service_completed_successfully` em `migrate` deixaria `api1`/`api2`/`worker` travados para sempre nesta etapa. Isso está documentado em comentário no próprio `docker-compose.yml`, junto com a observação de que, quando `migrate` passar a rodar migrations/seed reais e terminar, essa dependência deve ser adicionada.

**Sugestões da revisão**
- `docker-compose.yml` (serviço `mysql`) — o fallback `${MYSQL_ROOT_PASSWORD:-root}` duplica o valor padrão que já está em `.env.example`; considerar remover o fallback do compose e exigir sempre um `.env` real, para não ter dois lugares com o mesmo default a manter sincronizados.
- Lembrete para quando `migrate` ganhar lógica real (fora desta tarefa): trocar a dependência de `api1`/`api2`/`worker` em `migrate` de "mysql healthy" para `service_completed_successfully` em `migrate`, já que hoje ele nunca termina.
