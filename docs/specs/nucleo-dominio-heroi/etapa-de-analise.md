# Núcleo de domínio Herói, concorrência primeiro

**Tipo:** funcionalidade · **Status:** concluída · **Atualizada em:** 2026-11-10

## Problema

O sistema ainda não tem nenhuma forma de criar, consultar, editar, buscar ou excluir heróis — só o schema de banco existe. Sem isso, não há como usar o sistema de heróis e missões, nem avaliar o diferencial do desafio: a API roda em duas instâncias atrás de um único endereço, e qualquer pedido pode cair em qualquer uma, então toda regra precisa continuar certa sob concorrência.

## Solução

Implementar o módulo de heróis (`apps/api/src/modules/heroes`), cobrindo, na ordem de risco definida: idempotência genérica reutilizável, CRUD básico, lock otimista (`version`), soft delete e inativação, busca com paginação por cursor, detecção de herói repetido, e histórico de alterações. Cada regra protegida por teste de integração contra MySQL real antes de passar para a próxima, e a tarefa inteira antes de começar missões.

**Motivo da escolha:** as regras de negócio (CLAUDE.md raiz, "Regras de negócio — Herói") e a implementação técnica de cada uma (`apps/api/CLAUDE.md`) já estão decididas; esta tarefa materializa essas decisões no módulo de heróis, na ordem de risco que você definiu — concorrência (idempotência, lock otimista) antes do caminho feliz.

## Escopo

**Inclui:**

1. **Idempotência genérica** — `apps/api/src/http/idempotency.ts`: `withIdempotency(scope, key, requestHash, fn)`, que roda dentro da mesma transação de `fn`: insere a chave (`idempotency_keys`, PK `(scope, key)`), executa `fn`, grava a resposta e confirma. Em *duplicate key*: hash igual devolve a resposta salva com `Idempotent-Replayed: true`; hash diferente lança `IDEMPOTENCY_KEY_MISMATCH`. `Idempotency-Key` ausente num POST de criação dá 400 `BAD_REQUEST`. Testado isoladamente (com uma função `fn` qualquer) antes de ser usado pelo módulo de heróis.
2. **CRUD básico** — `POST /heroes` (cria, ignora `id`/`created_at`/`updated_at`/`version`/`deleted_at` enviados, usa `createHeroSchema` do `shared`), `GET /heroes/:id` (404 se não existe ou está excluído), `GET /heroes` (lista simples, mais novos primeiro, 10 por página).
3. **Lock otimista** — `PATCH /heroes/:id` (usa `updateHeroSchema`, que já exige `version`): `UPDATE heroes SET ..., version = version + 1, updated_at = NOW(3) WHERE id = :id AND version = :version AND deleted_at IS NULL`. Zero linhas afetadas → busca o herói: inexistente ou excluído dá 404; existente dá 409 `VERSION_CONFLICT` com `details.current`. Aplica só os campos enviados.
4. **Soft delete e inativação** — `DELETE /heroes/:id` (preenche `deleted_at`, nunca volta a `null`; some da lista, da busca e do `GET`); `POST /heroes/:id/activate` e `POST /heroes/:id/deactivate` (alternam `is_active`; herói inativo continua na lista, mas não pode ser escalado — a parte de escalação fica para a tarefa de missões). Ambos usam o mesmo mecanismo de lock otimista do item 3 (corpo com `version`).
5. **Busca e paginação por cursor** — `GET /heroes?q=&cursor=&limit=` : busca por `name`/`nickname`, qualquer parte do texto, sem diferenciar maiúsculas/acentos (collation `utf8mb4_0900_ai_ci`), com `%`/`_`/`\` do texto digitado escapados. Cursor opaco (base64url de `created_at`+`id`), `ORDER BY created_at DESC, id DESC`. Nenhum herói repete nem some entre páginas, mesmo com vários criados no mesmo `created_at`.
6. **Herói repetido** — índice único `(name, nickname, date_of_birth)` já existe (tarefa anterior); o repository traduz o erro de chave duplicada do MySQL em `DUPLICATE_HERO` (409). Vale também contra heróis já excluídos.
7. **Histórico** — tabela `hero_changes` já existe; o diff (campo, valor antigo, valor novo) é calculado no servidor e gravado na mesma transação de toda alteração (criação, atualização, ativação/inativação, exclusão), com `event` correspondente. `GET /heroes/:id/history`: paginado por cursor, filtro por `field` e período. Nesta tarefa o histórico cobre só as mudanças de campo do próprio herói — a parte "missões de que participou com o resultado" depende do módulo de missões e fica para quando ele existir.

**Não inclui:**

- Módulo de missões e escalação (a regra "herói inativo/excluído não pode ser escalado" só é testável quando `POST /missions/:id/assign` existir).
- Upload de avatar, importação de CSV, seed de 100k heróis, tela (web).
- Benchmark de desempenho (p95 < 0,3s) — fica para quando o volume de 100k existir via seed.
- A parte de "missões participadas com resultado" no histórico (depende do módulo de missões).
- Merge de edições simultâneas na tela (a API só precisa devolver `details.current` em `VERSION_CONFLICT`; juntar os valores é trabalho da tela, de uma tarefa futura).

## Critérios de aceite

- [ ] C1 — `withIdempotency` testado isoladamente: duas chamadas concorrentes com a mesma chave e o mesmo corpo resultam em uma execução de `fn` só, e a segunda chamada recebe a resposta salva com `Idempotent-Replayed: true`. Mesma chave com hash de corpo diferente lança `IDEMPOTENCY_KEY_MISMATCH`.
- [ ] C2 — `POST /heroes` sem `Idempotency-Key` dá 400 `BAD_REQUEST`. Dois `POST /heroes` concorrentes com a mesma `Idempotency-Key` e o mesmo corpo resultam em exatamente um herói criado.
- [ ] C3 — `POST /heroes` ignora `id`, `created_at`, `updated_at`, `version`, `deleted_at` enviados no corpo. Campo obrigatório vazio ou só com espaços dá 422 com `fields`. `date_of_birth` futura dá 422.
- [ ] C4 — `GET /heroes/:id` devolve o herói existente; devolve 404 se o id não existe ou se o herói está excluído.
- [ ] C5 — `GET /heroes` lista os heróis não excluídos, mais novos primeiro, 10 por página.
- [ ] C6 — `PATCH /heroes/:id` com a `version` atual aplica só os campos enviados, incrementa `version` e atualiza `updated_at`. Duas chamadas concorrentes de `PATCH` com a mesma `version` resultam em exatamente uma com 200 e uma com 409 `VERSION_CONFLICT` (com `details.current`).
- [ ] C7 — `PATCH` (ou `activate`/`deactivate`/`DELETE`) num herói inexistente dá 404; num herói excluído dá 404; com `version` antiga (herói existe e não está excluído) dá 409 `VERSION_CONFLICT`.
- [ ] C8 — `DELETE /heroes/:id` preenche `deleted_at`; o herói some de `GET /heroes` (lista e busca) e de `GET /heroes/:id` (404). Excluir de novo (ou editar) um herói já excluído dá 404.
- [ ] C9 — `POST /heroes/:id/activate` e `POST /heroes/:id/deactivate` alternam `is_active`; um herói inativo continua aparecendo em `GET /heroes` e em `GET /heroes/:id`.
- [ ] C10 — `GET /heroes?q=` encontra por `name` ou `nickname`, em qualquer parte do texto, sem diferenciar maiúsculas nem acentos (`joao` encontra "João"). Os caracteres `%`, `_` e `\` digitados na busca são tratados como texto literal, não como operadores do `LIKE`.
- [ ] C11 — Paginando por `GET /heroes` com vários heróis criados com o mesmo `created_at`, nenhum herói se repete nem some entre as páginas.
- [ ] C12 — `POST /heroes` com `name`+`nickname`+`date_of_birth` iguais a um herói já existente (ativo ou excluído) dá 409 `DUPLICATE_HERO`.
- [ ] C13 — Toda criação, atualização, ativação, inativação e exclusão de herói grava em `hero_changes`, na mesma transação, uma linha por campo alterado, com o valor antigo e o novo. `GET /heroes/:id/history` devolve essas linhas paginadas por cursor, com filtro por `field` e por período.

## Decisões

- Ativar/inativar um herói são endpoints próprios (`POST /heroes/:id/activate` e `.../deactivate`), não um campo de `PATCH` — Motivo: `hero_changes.event` distingue `activated`/`inactivated` de `updated`; endpoints dedicados tornam esse evento explícito em vez de inferido de um diff genérico.
- Todos os endpoints que alteram o herói (`PATCH`, `activate`, `deactivate`, `DELETE`) exigem `version` no corpo e seguem o mesmo mecanismo de lock otimista do item 3 — Motivo: consistência; sem isso, um `DELETE` concorrente com um `PATCH` poderia gravar histórico incoerente ou perder uma edição silenciosamente.
- `withIdempotency` é testado com uma função `fn` de exemplo antes de o módulo de heróis existir (ordem do risco pedida pelo usuário) — Motivo: isolar a prova de concorrência do helper genérico do comportamento específico de criar um herói, para um teste que falhe aponte exatamente de qual dos dois é a causa.
- O histórico desta tarefa cobre só os campos do próprio herói (não a lista de missões participadas) — Motivo: a lista de missões depende de `mission_heroes JOIN missions`, que só faz sentido quando o módulo de missões existir; registrado como fora do escopo, não como ponto em aberto, porque não há decisão pendente — é sequência natural das fases.

## Detalhes

- [etapas/](etapas/) — etapas de desenvolvimento, uma por arquivo, em ordem; abra ao implementar.

