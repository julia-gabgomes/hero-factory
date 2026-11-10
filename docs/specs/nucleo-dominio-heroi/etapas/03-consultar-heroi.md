# 03 — Consultar um herói por id

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** 02 (criar heróis)

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
`GET /heroes/:id` passa a existir: devolve o herói quando ele existe e não está excluído; devolve 404 quando o id não existe ou quando o herói foi excluído. Como a exclusão (`DELETE`) só é implementada numa etapa futura, o cenário de "herói excluído" desta etapa insere a linha diretamente no banco (via factory de teste) com `deleted_at` preenchido, sem depender do endpoint de exclusão.

## Critérios de aceite
- [x] C1 — `GET /heroes/:id` de um herói existente e não excluído devolve 200 com os dados do herói.
- [x] C2 — `GET /heroes/:id` de um id que não existe devolve 404 `NOT_FOUND`.
- [x] C3 — `GET /heroes/:id` de um herói com `deleted_at` preenchido devolve 404 `NOT_FOUND`.

## Cenários de teste
- **C1.a** — Dado um herói criado via `POST /heroes`, quando se chama `GET /heroes/:id` com o id dele, então a resposta é 200 com os mesmos dados do herói.
- **C2.a** — Dado um id que nunca foi usado (UUID aleatório), quando se chama `GET /heroes/:id`, então a resposta é 404 com `error.code = "NOT_FOUND"`.
- **C3.a** — Dado um herói inserido diretamente no banco com `deleted_at` preenchido, quando se chama `GET /heroes/:id` com o id dele, então a resposta é 404 com `error.code = "NOT_FOUND"`.

## Registro da implementação
**Testes**
- `apps/api/test/modules/heroes/get-hero.test.ts` — cenários C1.a, C2.a, C3.a

**O que foi alterado**
- `GET /heroes/:id` passou a existir: devolve o herói com 200 quando ele existe e não está excluído, e 404 com `error.code = "NOT_FOUND"` quando o id não existe ou o herói foi excluído.

**Sugestões da revisão**
- `apps/api/src/modules/heroes/routes.ts` — o schema de params usa `z.string()` para `id`, sem `.uuid()`; validar o formato daria uma mensagem mais explícita em caso de erro de digitação/integração (hoje cai no mesmo 404, o que é aceitável).
