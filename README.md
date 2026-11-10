# Hero Factory

Sistema de heróis e missões, feito como desafio técnico fullstack. A API
roda em **duas instâncias** atrás de um único Nginx, com MySQL como única
fonte de verdade — nenhum estado fica na memória da API.

Guia completo de arquitetura, contratos e decisões: [`CLAUDE.md`](CLAUDE.md),
[`apps/api/CLAUDE.md`](apps/api/CLAUDE.md), [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md)
e [`docs/decisions.md`](docs/decisions.md).

## Status atual

- **Núcleo de domínio (API):** Herói e Missão completos — CRUD, busca e
  paginação por cursor, bloqueio otimista, idempotência, inativação e
  exclusão lógica, histórico, máquina de estados de missão e escalação com
  lock e choque de horário.
- **Infraestrutura:** seed de 100k heróis, `Server-Timing`, limpeza de
  idempotência, Docker Compose com `api1`/`api2`/`migrate` reais, benchmark
  k6 (ver [`docs/performance.md`](docs/performance.md)).
- **Tela (`apps/web`):** lista, busca e paginação de heróis; criar, editar
  (com merge de três vias em conflito de edição simultânea), inativar/ativar
  e excluir, com confirmação; detalhes com abas Dados · Alterações ·
  Missões; missões (lista, criar, máquina de estados, escalar/remover
  herói). Servida pelo Nginx a partir do build de produção do Vite.
- **Pendente:** upload de avatar e importação de CSV (ambos opcionais, a
  API ainda não os expõe), suíte E2E (Playwright).

## Pré-requisitos

- Para **rodar** o projeto: Docker com Compose v2.
- Para **desenvolver**: Node 24 (`nvm use`) e `corepack enable` (instala o
  pnpm pela versão fixada em `package.json`).

## Como rodar

```bash
cp .env.example .env
docker compose up --build
```

Abra `http://localhost`. O banco sobe vazio (migrations aplicadas, sem
dados). Para subir já com os 100 mil heróis do seed (idempotente):

```bash
SEED_ON_START=true docker compose up --build
```

Para derrubar e apagar os dados:

```bash
docker compose down -v
```

A API fica atrás do Nginx em `/api/*` (ex.: `http://localhost/api/heroes`).

## Desenvolvimento local

```bash
pnpm install
docker compose up -d mysql
pnpm --filter @hero-factory/api run db:migrate
pnpm --filter @hero-factory/api exec tsx watch src/server.ts
```

Em outro terminal, a tela com hot reload e proxy de `/api` para a API local:

```bash
pnpm --filter @hero-factory/web dev
```

Abra `http://localhost:5173`. A API local lê `DATABASE_URL` do `.env` da
raiz (aponta para o MySQL do compose publicado em `MYSQL_PORT`).

## Comandos

| Objetivo | Comando |
|---|---|
| Subir tudo (banco vazio, o padrão) | `docker compose up --build`, depois abrir http://localhost |
| Subir com o seed de 100k | `SEED_ON_START=true docker compose up --build` |
| Derrubar e apagar os dados | `docker compose down -v` |
| Instalar dependências | `pnpm install` |
| Lint | `pnpm lint` |
| Checagem de tipos | `pnpm typecheck` |
| Formatar | `pnpm format` |
| Testes (unitários e de integração, exige Docker) | `pnpm test` |
| Testes de um pacote | `pnpm --filter @hero-factory/api test` / `pnpm --filter @hero-factory/web test` / `pnpm --filter @hero-factory/shared test` |
| Dev da tela (hot reload, proxy de `/api`) | `pnpm --filter @hero-factory/web dev` |
| Gerar migration a partir do schema | `pnpm db:generate` |
| Aplicar migrations | `pnpm db:migrate` |
| Seed (idempotente) | `pnpm db:seed` |
| Resetar o banco (migrations e seed) | `pnpm db:reset` |
| Benchmark de 0,3s (precisa do compose de pé com seed) | `docker compose --profile bench run --rm k6` |

## Variáveis de ambiente

Ver [`.env.example`](.env.example) — copie para `.env` antes de rodar
qualquer comando acima.

## Estrutura

```
hero-factory/
├─ apps/
│  ├─ api/          Fastify: modules/{heroes,missions}, db/, http/, app.ts, server.ts
│  └─ web/          React: features/{heroes,missions}, components/ui, lib/, routes/
├─ packages/
│  └─ shared/src/   schemas Zod · tipos inferidos · limites de campos · códigos de erro
├─ bench/           script k6 (heroes.js)
├─ nginx/           nginx.conf · Dockerfile (builda e serve a SPA)
├─ docs/            performance.md · decisions.md
├─ docker-compose.yml
├─ Dockerfile        imagem da API (migrate/api1/api2)
├─ .env.example
└─ CLAUDE.md
```
