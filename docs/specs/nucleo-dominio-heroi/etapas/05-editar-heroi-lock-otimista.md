# 05 — Editar um herói com lock otimista

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** 02 (criar heróis), 03 (consultar um herói)

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
`PATCH /heroes/:id` passa a existir: valida o corpo com `updateHeroSchema` (`packages/shared`, que já exige `version`), aplica só os campos enviados, e usa o lock otimista (`UPDATE ... WHERE id = :id AND version = :version AND deleted_at IS NULL`). Zero linhas afetadas distingue 404 (herói inexistente ou excluído) de 409 `VERSION_CONFLICT` (herói existe, mas a `version` enviada está desatualizada).

## Critérios de aceite
- [x] C1 — `PATCH /heroes/:id` com a `version` atual e um ou mais campos aplica só os campos enviados, incrementa `version` em 1 e atualiza `updated_at`.
- [x] C2 — `PATCH /heroes/:id` de um id que não existe devolve 404 `NOT_FOUND`.
- [x] C3 — `PATCH /heroes/:id` de um herói com `deleted_at` preenchido (inserido direto no banco) devolve 404 `NOT_FOUND`, mesmo enviando a `version` correta.
- [x] C4 — `PATCH /heroes/:id` com uma `version` desatualizada, num herói que existe e não está excluído, devolve 409 `VERSION_CONFLICT` com `details.current` contendo o estado atual do herói.
- [x] C5 — Dois `PATCH /heroes/:id` concorrentes com a mesma `version` (a atual) resultam em exatamente uma resposta 200 e uma resposta 409 `VERSION_CONFLICT`.

## Cenários de teste
- **C1.a** — Dado um herói com `version = 1`, quando se chama `PATCH /heroes/:id` com `{ nickname: "Novo Nick", version: 1 }`, então a resposta é 200, o `nickname` muda, os demais campos continuam iguais, `version` passa a ser `2`, e `updated_at` é mais recente que antes.
- **C2.a** — Dado um id que nunca foi usado, quando se chama `PATCH /heroes/:id` com um corpo válido (incluindo `version`), então a resposta é 404 com `error.code = "NOT_FOUND"`.
- **C3.a** — Dado um herói com `deleted_at` preenchido (inserido direto no banco) e `version = 1`, quando se chama `PATCH /heroes/:id` com `version: 1`, então a resposta é 404 com `error.code = "NOT_FOUND"`.
- **C4.a** — Dado um herói com `version = 2` no banco, quando se chama `PATCH /heroes/:id` com `version: 1` (desatualizada), então a resposta é 409 com `error.code = "VERSION_CONFLICT"` e `details.current` igual ao estado atual do herói (incluindo `version: 2`).
- **C5.a** — Dado um herói com `version = 1`, quando se disparam dois `PATCH /heroes/:id` concorrentes com `version: 1` e corpos diferentes entre si (barreira), então exatamente uma das respostas é 200 e a outra é 409 `VERSION_CONFLICT`.

## Registro da implementação
**Testes**
- `apps/api/test/modules/heroes/update-hero.test.ts` — cenários C1.a, C2.a, C3.a, C4.a, C5.a

**O que foi alterado**
- `PATCH /heroes/:id` passou a existir: aplica só os campos enviados, confere a `version` via lock otimista e devolve o herói atualizado (200), 404 quando o id não existe ou está excluído, ou 409 `VERSION_CONFLICT` com o estado atual em `details.current` quando a `version` enviada está desatualizada.

**Sugestões da revisão**
- `apps/api/src/modules/heroes/service.ts` — depois do `UPDATE` bem-sucedido, uma segunda consulta busca o herói para montar a resposta; se uma escrita concorrente acontecer entre o `UPDATE` e essa consulta, a resposta pode refletir uma versão mais nova que a deste `PATCH` (inofensivo hoje, mas vale lembrar se uma etapa futura precisar que a resposta reflita exatamente o que foi escrito).
