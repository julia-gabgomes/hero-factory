# Infra de dados: schema Drizzle, migrations e Testcontainers

**Tipo:** funcionalidade · **Status:** concluída · **Atualizada em:** 2026-11-09

## Problema

Não existe schema de banco, migration nem forma de testar contra um MySQL real. Sem isso, nenhuma regra de negócio de heróis ou missões pode ser implementada nem protegida por teste de integração, como o `CLAUDE.md` exige (MySQL real via Testcontainers, não mock).

## Solução

Criar os 5 schemas Drizzle (`heroes`, `missions`, `mission_heroes`, `hero_changes`, `idempotency_keys`) com os tipos, índices e PKs já decididos em `apps/api/CLAUDE.md`, gerar e revisar a migration SQL, e criar o helper de Testcontainers que toda a suíte de integração da API vai reutilizar.

**Motivo da escolha:** as decisões de schema já estão tomadas em `apps/api/CLAUDE.md` ("Banco: tipos e convenções", "Lista, paginação e busca", "Idempotência", "Edição simultânea", "Escalação e choque de horário", "Exclusão e histórico", "Herói repetido e seed") — esta tarefa só materializa essas decisões em código Drizzle, migration e helper de teste.

## Escopo

**Inclui:**

- `apps/api/src/db/schema/heroes.ts`: `id` (`CHAR(36) CHARACTER SET ascii COLLATE ascii_bin`, UUIDv7), `name`/`nickname`/`universe`/`main_power` (`VARCHAR` utf8mb4, `utf8mb4_0900_ai_ci`, limites de `packages/shared`), `date_of_birth` (`DATE`, `dateStrings: true`), `avatar_url` (`VARCHAR(2048)`, opcional), `is_active`, `deleted_at`, `version INT NOT NULL DEFAULT 1`, `created_at`/`updated_at` (`DATETIME(3)` UTC).
  - Índice único `(name, nickname, date_of_birth)` — vale para excluídos também.
  - Índice `(deleted_at, created_at, id, name, nickname)` — cobre lista, paginação por cursor e busca por `LIKE`.
- `apps/api/src/db/schema/missions.ts`: `id`, `title` (limite de `packages/shared`), `status` (`scheduled`/`in_progress`/`succeeded`/`failed`/`cancelled`), `starts_at`/`ends_at` (`DATETIME(3)` UTC), `created_at`/`updated_at`.
  - Índice `(status, starts_at, ends_at)` — usado na checagem de choque de horário.
- `apps/api/src/db/schema/mission_heroes.ts`: `mission_id`, `hero_id`, PK composta `(mission_id, hero_id)`.
  - Índice `(hero_id)` — usado na checagem de choque de horário por herói.
- `apps/api/src/db/schema/hero_changes.ts`: `id`, `hero_id`, `event` (`created`/`updated`/`activated`/`inactivated`/`deleted`), `field`, `old_value`, `new_value`, `created_at`.
  - Índice `(hero_id, created_at, id)` — paginação do histórico.
- `apps/api/src/db/schema/idempotency_keys.ts`: `scope`, `key`, PK composta `(scope, key)`, `request_hash`, `response_status`, `response_body`, `created_at`.
- `pnpm db:generate` executado e o SQL gerado revisado à mão (índices, collation, `DATETIME(3)`, charset/collation ascii dos IDs).
- `apps/api/test/testcontainers.ts`: helper que sobe um MySQL 8.4 real via Testcontainers, aplica as migrations e devolve uma conexão/cliente Drizzle para os testes, com um teste trivial provando que o helper funciona (ex.: inserir e ler uma linha).

**Não inclui:**

- Qualquer rota, service ou regra de negócio (próxima fase, feature por feature).
- O seed de 100 mil heróis (`db/seed.ts`) — fica para quando a feature de heróis existir, já que depende dos schemas desta tarefa mas não precisa estar pronto para o DoD daqui.
- A evolução para FULLTEXT/ngram em volumes maiores — já documentada como não implementada em `apps/api/CLAUDE.md`.

## Critérios de aceite

- [ ] `docker compose up -d mysql` seguido de `pnpm db:migrate` aplica as migrations sem erro, do zero.
- [ ] O SQL gerado por `pnpm db:generate` foi lido e confirma: collation `utf8mb4_0900_ai_ci` nos textos, `CHARACTER SET ascii COLLATE ascii_bin` nos IDs, `DATE` em `date_of_birth`, `DATETIME(3)` nos timestamps, `version INT NOT NULL DEFAULT 1`, os índices e as PKs compostas listados no escopo.
- [ ] Um teste de integração usando `apps/api/test/testcontainers.ts` sobe o MySQL via Testcontainers, aplica as migrations e executa uma operação trivial (inserir e ler uma linha) com sucesso.
- [ ] O índice único de herói cobre `(name, nickname, date_of_birth)`, incluindo linhas com `deleted_at` preenchido (duas linhas com os três valores iguais, uma excluída e outra não, violam a unicidade).

## Decisões

- Tipos e índices seguem exatamente `apps/api/CLAUDE.md` (seções "Banco: tipos e convenções" até "Herói repetido e seed") — nenhuma decisão nova de schema é tomada aqui, só a implementação em Drizzle.
- `date_of_birth` usa `dateStrings: true` no driver — Motivo: `packages/shared` já trata essa data como string `"YYYY-MM-DD"` ponta a ponta; se o driver devolvesse `Date` do JS, a API teria que reconverter, reabrindo o risco de bug de fuso que `packages/shared` já evita.
- `idempotency_keys` e `mission_heroes` usam PK composta em vez de `id` próprio — Motivo: já documentado em `apps/api/CLAUDE.md`; a PK composta é o mecanismo de lock que impede duplicidade (chave reutilizada, herói escalado duas vezes).
- O seed de 100k heróis fica fora desta tarefa — Motivo: não bloqueia o DoD (migration limpa + teste trivial via Testcontainers); entra na fase em que a feature de heróis for implementada, para já nascer testado contra o schema real.

## Detalhes

- [etapas/](etapas/) — etapas de desenvolvimento, uma por arquivo, em ordem; abra ao implementar.
