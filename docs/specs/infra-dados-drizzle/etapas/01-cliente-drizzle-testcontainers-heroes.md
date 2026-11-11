# 01 — Criar o cliente Drizzle, o helper de Testcontainers e o schema de heroes

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** nenhuma

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
`apps/api` passa a ter um cliente Drizzle configurado para MySQL (`dateStrings: true`, timezone UTC), o schema da tabela `heroes` com os tipos, o índice único e o índice composto decididos em `apps/api/CLAUDE.md`, a migration gerada e aplicável via `pnpm db:migrate`, e `apps/api/test/testcontainers.ts`, o helper que sobe um MySQL real via Testcontainers e aplica as migrations, reutilizável por toda a suíte de integração. Um teste trivial prova que o helper funciona de ponta a ponta.

## Critérios de aceite
- [ ] C1 — Com `docker compose up -d mysql` rodando, `pnpm db:migrate` aplica a migration da tabela `heroes` sem erro, do zero.
- [x] C2 — O SQL gerado por `pnpm db:generate` cria `heroes.id` como `CHAR(36)` com charset `ascii` e collation `ascii_bin`.
- [x] C3 — O SQL gerado cria as colunas de texto (`name`, `nickname`, `universe`, `main_power`, `avatar_url`) como `VARCHAR` com collation `utf8mb4_0900_ai_ci`, respeitando os limites de `packages/shared` (`name` 120, `nickname` 60, `universe` 60, `main_power` 80, `avatar_url` 2048).
- [x] C4 — O SQL gerado cria `date_of_birth` como `DATE` e `created_at`/`updated_at` como `DATETIME(3)`.
- [x] C5 — O SQL gerado cria `version` como `INT NOT NULL DEFAULT 1`.
- [x] C6 — Existe um índice único cobrindo `(name, nickname, date_of_birth)`.
- [x] C7 — Existe um índice cobrindo `(deleted_at, created_at, id, name, nickname)`, nessa ordem de colunas.
- [x] C8 — `apps/api/test/testcontainers.ts` sobe um MySQL 8.4 via Testcontainers, aplica as migrations, e um teste trivial consegue inserir e ler uma linha na tabela `heroes` usando o cliente Drizzle.
- [x] C9 — O índice único de C6 rejeita duas linhas com o mesmo `(name, nickname, date_of_birth)` mesmo quando uma delas tem `deleted_at` preenchido.

## Cenários de teste
- **C1.a (verificação manual)** — Rodar `docker compose up -d mysql` e, em seguida, `pnpm db:migrate` num banco vazio → a migration aplica sem erro e a tabela `heroes` passa a existir.
- **C2.a** — Dado o arquivo de migration SQL gerado, quando se lê a definição da coluna `id` de `heroes`, então ela é `CHAR(36) CHARACTER SET ascii COLLATE ascii_bin`.
- **C3.a** — Dado o arquivo de migration SQL gerado, quando se lê a definição de `name`, então ela é `VARCHAR(120)` com collation `utf8mb4_0900_ai_ci` (e o mesmo padrão para `nickname` VARCHAR(60), `universe` VARCHAR(60), `main_power` VARCHAR(80), `avatar_url` VARCHAR(2048) opcional).
- **C4.a** — Dado o arquivo de migration SQL gerado, quando se lê a definição de `date_of_birth`, então ela é `DATE`; quando se lê `created_at` e `updated_at`, então são `DATETIME(3)`.
- **C5.a** — Dado o arquivo de migration SQL gerado, quando se lê a definição de `version`, então ela é `INT NOT NULL DEFAULT 1`.
- **C6.a** — Dado o banco com a migration aplicada (via Testcontainers), quando se insere uma linha com `name`, `nickname` e `date_of_birth` iguais a uma linha já existente, então o banco rejeita com erro de chave duplicada.
- **C7.a** — Dado o arquivo de migration SQL gerado, quando se lê os índices da tabela `heroes`, então existe um índice cobrindo exatamente `(deleted_at, created_at, id, name, nickname)`, nessa ordem.
- **C8.a** — Dado o helper `apps/api/test/testcontainers.ts`, quando um teste o usa para subir o banco, aplicar as migrations e inserir uma linha em `heroes`, então a leitura seguinte dessa linha devolve os mesmos valores inseridos.
- **C9.a** — Dado o banco com a migration aplicada, quando se insere uma linha ativa com `name`/`nickname`/`date_of_birth` X e depois se tenta inserir outra linha com `deleted_at` preenchido mas o mesmo `name`/`nickname`/`date_of_birth` X, então a segunda inserção é rejeitada por chave duplicada.

## Registro da implementação
**Testes**
- `apps/api/test/heroes-schema.test.ts` — cenários C2.a, C3.a, C4.a, C5.a, C6.a, C7.a, C8.a, C9.a (C1.a é verificação manual, não automatizada).

**O que foi alterado**
- `apps/api` passou a ter um cliente Drizzle (`src/db/client.ts`, `createDbClient`) configurado para MySQL com `dateStrings: true` e `timezone: 'Z'`, reutilizado tanto pela futura aplicação quanto pelo helper de testes.
- O schema da tabela `heroes` (`src/db/schema/heroes.ts`) foi criado com os tipos, o índice único `(name, nickname, date_of_birth)` e o índice composto `(deleted_at, created_at, id, name, nickname)` decididos em `apps/api/CLAUDE.md`.
- A migration gerada por `pnpm db:generate` foi revisada à mão para declarar explicitamente `CHARACTER SET ascii COLLATE ascii_bin` em `id` e `CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci` nas colunas de texto. Aplicada com sucesso via `pnpm db:migrate` contra o MySQL do compose, do zero.
- `apps/api/test/testcontainers.ts` sobe um MySQL 8.4 real via `@testcontainers/mysql`, aplica as migrations com `drizzle-orm/mysql2/migrator` e devolve `{ db, stop }`, reutilizável pelo resto da suíte de integração.

**Desvios do planejado**
- As propriedades do schema Drizzle usam `snake_case` (ex. `heroes.main_power`, `heroes.date_of_birth`), e não `camelCase`, para corresponder 1:1 aos nomes de coluna e ao contrato JSON `snake_case` da API — os testes já constroem e leem as linhas com essas chaves.
- `apps/api/tsconfig.json` passou a incluir `"test"` além de `"src"`, então `pnpm --filter api typecheck` cobre os testes de integração também (mesmo padrão de `packages/shared`). Não foi necessário um tsconfig separado para o ESLint.

**Correção pós-revisão:** `src/db/client.ts` tinha um `Object.defineProperty(DrizzleQueryError.prototype, "code", ...)` para expor em `error.code` o que só existe em `error.cause.code`, só para satisfazer `toMatchObject({ code: "ER_DUP_ENTRY" })` no teste. A revisão apontou como bloqueante: monkey-patch global no protótipo de uma classe de terceiros, em efeito colateral de import, resolvendo uma necessidade que hoje só existe na asserção do teste — um upgrade do drizzle-orm que mude a forma de aninhar `cause` faria o getter devolver `undefined` silenciosamente. Removido o patch; os testes C6.a/C9.a passaram a assertar `cause: { code: "ER_DUP_ENTRY" }`. A tradução de `ER_DUP_ENTRY` para `DUPLICATE_HERO` fica para quando o repository de heróis for implementado (CLAUDE.md da API já atribui essa tradução ao repository, não ao client).
