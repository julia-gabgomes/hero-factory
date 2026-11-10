# 07 — Ativar e inativar um herói

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** 02 (criar heróis), 05 (lock otimista)

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
`POST /heroes/:id/activate` e `POST /heroes/:id/deactivate` passam a existir: ambos exigem `version` no corpo e usam o mesmo lock otimista das etapas 05/06 para alternar `is_active`. Um herói inativo continua aparecendo em `GET /heroes` e `GET /heroes/:id` — só não pode ser escalado (regra que entra na tarefa de missões).

## Critérios de aceite
- [x] C1 — `POST /heroes/:id/deactivate` com a `version` atual marca `is_active = false`.
- [x] C2 — `POST /heroes/:id/activate` com a `version` atual marca `is_active = true`.
- [x] C3 — Um herói inativo continua aparecendo em `GET /heroes` e `GET /heroes/:id` (card "cinza" é regra da tela, fora desta API).
- [x] C4 — `activate`/`deactivate` num id que não existe devolve 404 `NOT_FOUND`.
- [x] C5 — `activate`/`deactivate` num herói excluído devolve 404 `NOT_FOUND`, mesmo com a `version` certa.
- [x] C6 — `activate`/`deactivate` com uma `version` desatualizada devolve 409 `VERSION_CONFLICT` com `details.current`.

## Cenários de teste
- **C1.a** — Dado um herói ativo com `version = 1`, quando se chama `POST /heroes/:id/deactivate` com `{ version: 1 }`, então a resposta indica sucesso e `GET /heroes/:id` mostra `is_active: false`.
- **C2.a** — Dado um herói inativo com `version = 2`, quando se chama `POST /heroes/:id/activate` com `{ version: 2 }`, então a resposta indica sucesso e `GET /heroes/:id` mostra `is_active: true`.
- **C3.a** — Dado um herói inativo, quando se chama `GET /heroes`, então ele aparece na lista; quando se chama `GET /heroes/:id`, então a resposta é 200 (não 404).
- **C4.a** — Dado um id que nunca foi usado, quando se chama `POST /heroes/:id/deactivate` com um corpo válido, então a resposta é 404 com `error.code = "NOT_FOUND"`.
- **C5.a** — Dado um herói excluído, quando se chama `POST /heroes/:id/activate` com a `version` certa, então a resposta é 404 com `error.code = "NOT_FOUND"`.
- **C6.a** — Dado um herói ativo com `version = 2`, quando se chama `POST /heroes/:id/deactivate` com `version: 1` (desatualizada), então a resposta é 409 com `error.code = "VERSION_CONFLICT"` e `details.current` com o estado atual.

## Registro da implementação
**Testes**
- `apps/api/test/modules/heroes/activate-deactivate-hero.test.ts` — cenários C1.a, C2.a, C3.a, C4.a, C5.a, C6.a

**O que foi alterado**
- `POST /heroes/:id/activate` e `POST /heroes/:id/deactivate` passam a existir, exigindo `{ version }` no corpo e devolvendo o herói atualizado (200) com `is_active` no novo valor.

**Desvios do planejado**
- Extraído `resolveOptimisticLockOutcome(db, id, affectedRows)` em `service.ts` (helper que resolve 404/409/sucesso a partir de linhas afetadas) e reutilizado por `updateHero`, `deleteHero`, `activateHero` e `deactivateHero`, resolvendo a duplicação já registrada na etapa 06.
- O schema local `deleteHeroBodySchema` (`routes.ts`) foi renomeado para `versionOnlyBodySchema` e passou a ser compartilhado por `DELETE /heroes/:id`, `POST /heroes/:id/activate` e `POST /heroes/:id/deactivate`. `PATCH /heroes/:id` continua usando `updateHeroSchema` (shared), sem interferência.

**Sugestões da revisão**
- `activate`/`deactivate` num herói que já está no estado-alvo (ex. inativar um já inativo) tem sucesso silencioso e incrementa `version`, sem cenário de teste explícito — comportamento razoável (não há regra proibindo), mas é uma lacuna de cobertura.
- `activateHero`/`deactivateHero` em `service.ts` diferem só no valor de `is_active`; poderiam unificar numa função parametrizada, mas a duplicação é pequena e os nomes explícitos ajudam a legibilidade — opcional.
