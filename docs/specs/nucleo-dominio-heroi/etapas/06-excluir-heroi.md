# 06 — Excluir um herói

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** 02 (criar heróis), 05 (lock otimista)

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
`DELETE /heroes/:id` passa a existir: exige `version` no corpo e usa o mesmo mecanismo de lock otimista da etapa 05 para preencher `deleted_at`. O herói excluído some de `GET /heroes` e de `GET /heroes/:id` (404), e `deleted_at` nunca volta a `null`.

## Critérios de aceite
- [x] C1 — `DELETE /heroes/:id` com a `version` atual preenche `deleted_at` e devolve sucesso.
- [x] C2 — Depois de excluído, o herói some de `GET /heroes` e `GET /heroes/:id` devolve 404.
- [x] C3 — `DELETE /heroes/:id` de um id que não existe devolve 404 `NOT_FOUND`.
- [x] C4 — `DELETE /heroes/:id` de um herói já excluído devolve 404 `NOT_FOUND`, mesmo com a `version` certa.
- [x] C5 — `DELETE /heroes/:id` com uma `version` desatualizada (herói existe, ativo) devolve 409 `VERSION_CONFLICT` com `details.current`.

## Cenários de teste
- **C1.a** — Dado um herói com `version = 1`, quando se chama `DELETE /heroes/:id` com `{ version: 1 }`, então a resposta indica sucesso e, consultando o banco diretamente, `deleted_at` do herói está preenchido.
- **C2.a** — Dado um herói excluído pela ação anterior, quando se chama `GET /heroes/:id`, então a resposta é 404; quando se chama `GET /heroes`, então esse herói não aparece na lista.
- **C3.a** — Dado um id que nunca foi usado, quando se chama `DELETE /heroes/:id` com um corpo válido, então a resposta é 404 com `error.code = "NOT_FOUND"`.
- **C4.a** — Dado um herói já excluído, quando se chama `DELETE /heroes/:id` de novo com a `version` certa, então a resposta é 404 com `error.code = "NOT_FOUND"`.
- **C5.a** — Dado um herói ativo com `version = 2`, quando se chama `DELETE /heroes/:id` com `version: 1` (desatualizada), então a resposta é 409 com `error.code = "VERSION_CONFLICT"` e `details.current` com o estado atual.

## Registro da implementação
**Testes**
- `apps/api/test/modules/heroes/delete-hero.test.ts` — cenários C1.a, C2.a, C3.a, C4.a, C5.a

**O que foi alterado**
- Agora é possível excluir um herói chamando `DELETE /heroes/:id` com `{ version }` no corpo. O herói excluído some da lista e da busca, e consultá-lo direto por id devolve "não encontrado". A exclusão é lógica (o registro continua no banco com `deleted_at` preenchido), então o nome dele continua aparecendo em missões de que participou.

**Sugestões da revisão**
- `apps/api/src/modules/heroes/routes.ts` — a validação de `version` no corpo do `DELETE` é um schema Zod local, repetindo a regra que já existe em `updateHeroSchema` (`packages/shared`); vale extrair um `versionSchema` compartilhado se mais ações passarem a precisar disso.
- `apps/api/src/modules/heroes/service.ts` — `deleteHero` repete quase literalmente a estrutura de `updateHero` (0 linhas afetadas → busca o estado atual → 404 ou 409). A etapa 07 (ativar/inativar) deve repetir o mesmo padrão uma terceira e quarta vez; se isso se confirmar, vale extrair um helper comum (ex. `resolveOptimisticLockOutcome`).
- A exclusão usa o mesmo mecanismo de lock otimista da edição (etapa 05): enviar a `version` desatualizada é recusado com a situação atual do herói, para quem está excluindo saber que algo mudou antes de tentar de novo.
