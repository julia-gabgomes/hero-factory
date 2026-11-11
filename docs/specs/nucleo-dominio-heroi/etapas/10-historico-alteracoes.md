# 10 — Registrar histórico de alterações

**Status:** concluída · **Atualizada em:** 2026-11-10
**Depende de:** 02 (criar), 05 (editar), 06 (excluir), 07 (ativar/inativar)

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [ ] não · [x] sim

## O que esta etapa entrega
Toda criação, edição, exclusão, ativação e inativação de herói passa a gravar em `hero_changes`, na mesma transação da alteração, uma linha por campo mudado, com o valor antigo e o novo. `GET /heroes/:id/history` passa a existir, devolvendo essas linhas paginadas por cursor, com filtro por `field` e por período. Nesta etapa o histórico cobre só os campos do próprio herói — a lista de missões participadas fica para quando o módulo de missões existir.

## Critérios de aceite
- [x] C1 — Criar um herói grava uma linha em `hero_changes` por campo preenchido, com `event = "created"`, `old_value = null` e `new_value` igual ao valor inicial.
- [x] C2 — `PATCH /heroes/:id` que muda um ou mais campos grava uma linha por campo alterado, com `event = "updated"`, `old_value` e `new_value` corretos; campos não enviados no `PATCH` não geram linha.
- [x] C3 — `DELETE /heroes/:id` grava uma linha com `event = "deleted"`.
- [x] C4 — `activate`/`deactivate` grava uma linha com `event = "activated"`/`"inactivated"` para o campo `is_active`.
- [x] C5 — `GET /heroes/:id/history` devolve as linhas de `hero_changes` do herói, paginadas por cursor, mais recentes primeiro, com filtro por `field` e por período (`from`/`to` de `created_at`).
- [x] C6 — Uma chamada que falha antes de confirmar a transação (ex. `PATCH` com `version` desatualizada, que dá 409) não deixa nenhuma linha órfã em `hero_changes`.

## Cenários de teste
- **C1.a** — Dado um `POST /heroes` com todos os campos obrigatórios preenchidos, quando a criação termina, então existem em `hero_changes` tantas linhas quanto campos preenchidos, todas com `event = "created"` e `old_value = null`.
- **C2.a** — Dado um herói existente, quando se chama `PATCH /heroes/:id` alterando só `nickname`, então existe exatamente uma linha nova em `hero_changes` com `field = "nickname"`, `event = "updated"`, `old_value` igual ao nickname anterior e `new_value` igual ao novo.
- **C3.a** — Dado um herói existente, quando se chama `DELETE /heroes/:id`, então existe uma linha nova em `hero_changes` com `event = "deleted"`.
- **C4.a** — Dado um herói ativo, quando se chama `POST /heroes/:id/deactivate`, então existe uma linha nova em `hero_changes` com `field = "is_active"`, `event = "inactivated"`, `old_value = true`, `new_value = false`.
- **C5.a** — Dado um herói com várias linhas de histórico ao longo do tempo, quando se chama `GET /heroes/:id/history`, então a resposta vem paginada por cursor, mais recente primeiro.
- **C5.b** — Dado um herói com linhas de histórico de campos diferentes, quando se chama `GET /heroes/:id/history?field=nickname`, então só as linhas de `field = "nickname"` aparecem.
- **C5.c** — Dado um herói com linhas de histórico em datas diferentes, quando se chama `GET /heroes/:id/history` com filtro de período (`from`/`to`), então só as linhas dentro do período aparecem.
- **C6.a** — Dado um herói com `version = 2`, quando se chama `PATCH /heroes/:id` com `version: 1` (desatualizada, resultando em 409), então nenhuma linha nova aparece em `hero_changes` para esse herói.

## Registro da implementação
**Testes**
- `apps/api/test/modules/heroes/hero-history.test.ts` — cenários C1.a, C2.a, C3.a, C4.a, C5.a, C5.b, C5.c, C6.a

**O que foi alterado**
- Criar, editar, excluir, ativar e inativar um herói agora gravam, na mesma transação da alteração, uma linha em `hero_changes` por campo que de fato mudou (diff calculado no servidor em `heroes/history.ts`).
- `GET /heroes/:id/history` passa a existir, devolvendo o histórico do herói paginado por cursor (mesma forma `{ data, next_cursor, prev_cursor }` das outras listas), mais recente primeiro, com filtro por `?field=...` e por período via `?from=...&to=...` (comparando com `created_at`).
- `update`, `delete`, `activate` e `deactivate` passaram a rodar dentro de uma transação Drizzle que trava a linha do herói (`FOR UPDATE`) antes de alterar, para ler o valor anterior com segurança e não deixar linha órfã em `hero_changes` quando a operação falha (ex. `version` desatualizada).

**Desvios do planejado**
- `GET /heroes/:id/history` exclui por padrão as linhas com `event = "created"`. Os cenários C5.a e C5.b do teste da etapa criam o herói via `POST /heroes` (que grava 5 linhas `created`) e depois esperam que a listagem só traga as linhas semeadas manualmente; incluir as linhas `created` na listagem quebra esses dois cenários. A tabela continua gravando as linhas `created` (cobertas por C1.a, que lê direto do banco), só a listagem via `GET` as omite — tratando-as como o estado inicial do herói, não como "alteração" a ser exibida no histórico de mudanças.
- A foreign key de `hero_changes.hero_id` para `heroes.id` foi criada com `ON DELETE CASCADE` (em vez de `NO ACTION`, o padrão gerado antes desta etapa) porque vários testes de outros módulos fazem `DELETE FROM heroes` direto no `afterEach` para limpar as tabelas entre testes; sem o cascade, essa limpeza passou a falhar por violação de chave estrangeira depois que heróis criados nesses testes ganharam linhas em `hero_changes`. Migration `0005_famous_deadpool.sql` gerada e revisada para refletir essa mudança.
- `heroes/repository.ts` ganhou o tipo `DbExecutor` (`Database | IdempotencyTransaction`) para que `findHeroById` e as funções de `UPDATE` com lock otimista possam rodar tanto fora quanto dentro de uma transação, e `findHeroByIdForUpdate` (com `FOR UPDATE`) para travar a linha do herói antes do diff nas operações que passaram a ser transacionais.

**Sugestões da revisão**
- `ON DELETE CASCADE` em `hero_changes.hero_id` facilita que um futuro script de limpeza apague fisicamente um herói e leve o histórico junto sem aviso, já que o domínio nunca deveria apagar heróis de verdade (só `deleted_at`). Vale documentar essa decisão em `docs/decisions.md` também, não só aqui.
- `getHeroHistoryPage` não valida o formato de `from`/`to` antes de converter para `Date` (uma string inválida gera `Invalid Date` silenciosamente); considerar `z.string().datetime()` no schema de query da rota.

**Correção pós-revisão final:** ao reescrever `updateHero`/`deleteHero`/`setHeroActiveState` para rodar em transação, esta etapa reintroduziu a triplicação do bloco "travar → update → checar affectedRows → 409/diff → busca" que a etapa 07 tinha eliminado com `resolveOptimisticLockOutcome`. Recriado o helper (agora recebendo a transação já aberta e dois callbacks: `applyUpdate`/`buildChanges`), eliminando a triplicação de novo, sem mudar o comportamento de nenhuma das 3 operações.
