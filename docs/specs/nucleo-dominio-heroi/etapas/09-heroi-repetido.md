# 09 — Detectar herói repetido

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** 02 (criar heróis), 05 (editar com lock otimista)

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
O repository de heróis passa a traduzir o erro de chave duplicada do índice único `(name, nickname, date_of_birth)` em `DUPLICATE_HERO` (409), tanto na criação quanto na edição (um `PATCH` que renomeia um herói para colidir com outro também é pego). Vale mesmo contra heróis já excluídos.

## Critérios de aceite
- [x] C1 — `POST /heroes` com `name`+`nickname`+`date_of_birth` iguais a um herói ativo já existente dá 409 `DUPLICATE_HERO`.
- [x] C2 — `POST /heroes` com `name`+`nickname`+`date_of_birth` iguais a um herói **excluído** já existente também dá 409 `DUPLICATE_HERO`.
- [x] C3 — `PATCH /heroes/:id` que mudaria `name`/`nickname`/`date_of_birth` do herói para uma combinação já usada por outro herói (ativo ou excluído) dá 409 `DUPLICATE_HERO`.

## Cenários de teste
- **C1.a** — Dado um herói ativo com `name = "Clark Kent"`, `nickname = "Super-Homem"`, `date_of_birth = "1938-04-18"`, quando se chama `POST /heroes` com esses mesmos três valores (demais campos podem variar), então a resposta é 409 com `error.code = "DUPLICATE_HERO"`.
- **C2.a** — Dado um herói excluído (inserido direto no banco com `deleted_at` preenchido) com `name`/`nickname`/`date_of_birth` X, quando se chama `POST /heroes` com os mesmos três valores X, então a resposta é 409 com `error.code = "DUPLICATE_HERO"`.
- **C3.a** — Dados dois heróis A e B distintos, quando se chama `PATCH /heroes/:idB` alterando `name`/`nickname`/`date_of_birth` de B para os mesmos valores de A, então a resposta é 409 com `error.code = "DUPLICATE_HERO"` e os dados de B não são alterados.

## Registro da implementação
**Testes**
- `apps/api/test/modules/heroes/duplicate-hero.test.ts` — cenários C1.a, C2.a, C3.a

**O que foi alterado**
- Ao criar ou editar um herói com `name`+`nickname`+`date_of_birth` já usados por outro (ativo ou excluído), a API agora responde 409 com `error.code = "DUPLICATE_HERO"` em vez de deixar o erro do banco vazar como 500.

**Desvios do planejado**
- A detecção de `ER_DUP_ENTRY` embrulhado em `DrizzleQueryError` (`error.cause.code`) foi extraída para `apps/api/src/db/mysql-errors.ts` (`isDuplicateEntryError`), e `http/idempotency.ts` passou a reaproveitar esse helper em vez de ter a própria cópia da checagem, como sugerido pela etapa.

**Sugestões da revisão**
- `isDuplicateEntryError` detecta duplicidade pelo código genérico `ER_DUP_ENTRY`, sem distinguir qual índice único foi violado. Hoje `heroes` só tem o UNIQUE `(name, nickname, date_of_birth)` além da PK, então não há ambiguidade — mas se a tabela ganhar outro UNIQUE no futuro, `DUPLICATE_HERO` seria reportado mesmo que o índice violado fosse outro. Revisitar extraindo o nome da constraint do erro do MySQL se isso acontecer.
