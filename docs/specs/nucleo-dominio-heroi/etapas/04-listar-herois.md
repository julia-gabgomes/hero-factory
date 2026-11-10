# 04 — Listar heróis

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** 02 (criar heróis)

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
`GET /heroes` passa a existir: devolve até 10 heróis não excluídos, mais novos primeiro (`ORDER BY created_at DESC, id DESC`). Ainda sem busca (`q`) nem cursor de paginação de verdade (etapa 08) — aqui só a primeira página, na ordem certa, excluindo quem tem `deleted_at` preenchido.

## Critérios de aceite
- [x] C1 — `GET /heroes` devolve os heróis não excluídos, mais novos primeiro.
- [x] C2 — `GET /heroes` devolve no máximo 10 heróis por página.
- [x] C3 — Heróis com `deleted_at` preenchido (inseridos diretamente no banco via factory, já que `DELETE` vem numa etapa futura) não aparecem na lista.
- [x] C4 — Sem nenhum herói cadastrado, `GET /heroes` devolve uma lista vazia, não um erro.

## Cenários de teste
- **C1.a** — Dados 3 heróis criados em sequência (A, depois B, depois C), quando se chama `GET /heroes`, então a ordem da lista é C, B, A (mais novo primeiro).
- **C2.a** — Dados 15 heróis criados, quando se chama `GET /heroes`, então a resposta tem exatamente 10 itens.
- **C3.a** — Dado um herói ativo e um herói com `deleted_at` preenchido (inserido direto no banco), quando se chama `GET /heroes`, então só o herói ativo aparece na lista.
- **C4.a** — Dado nenhum herói cadastrado (banco de teste limpo), quando se chama `GET /heroes`, então a resposta é 200 com `data = []`.

## Registro da implementação
**Testes**
- `apps/api/test/modules/heroes/list-heroes.test.ts` — cenários C1.a, C2.a, C3.a, C4.a

**O que foi alterado**
- `GET /heroes` passou a listar os heróis cadastrados: devolve até 10 heróis não excluídos, do mais novo para o mais antigo, no formato `{ data, next_cursor, prev_cursor }` (com `next_cursor` e `prev_cursor` ainda sempre `null`, já que o cursor de verdade vem na etapa 08).

**Correção pós-revisão:** o mapeamento `row → HeroResponse` estava duplicado em `findHeroById`, `insertHero` e a nova `listHeroes`. Extraído `mapRowToHeroResponse(row)`, reutilizado pelas 3 funções, sem mudar o comportamento de nenhuma (incluindo o caso de `insertHero`, que nunca tem `deleted_at`).
