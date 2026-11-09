# 06 — Criar os schemas de missão

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** 01 (limites)

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
`packages/shared` passa a ter, em `schemas/mission.ts`, o schema de criação de missão (`title` obrigatório, com `trim()` e limite de `limits.ts`) e o schema de transição de situação (`scheduled` → `in_progress` → `succeeded`/`failed`, mais `cancelled`), com `status` ignorado na criação mesmo se enviado.

## Critérios de aceite
- [x] C1 — O schema de criação exige `title`, com `trim()` aplicado e tratando texto só com espaços como vazio.
- [x] C2 — `title` respeita o limite de `mission.title` em `limits.ts` (120 code points); um valor acima é rejeitado.
- [x] C3 — `status` é ignorado pelo schema de criação, mesmo se enviado no objeto de entrada.
- [x] C4 — O schema de transição de situação só aceita um dos valores válidos: `scheduled`, `in_progress`, `succeeded`, `failed`, `cancelled`; qualquer outro valor é rejeitado.

## Cenários de teste
- **C1.a** — Dado um objeto com `title = "Resgate no centro"`, quando se valida contra o schema de criação, então a validação passa.
- **C1.b** — Dado um objeto com `title = "   "` (só espaços), quando se valida contra o schema de criação, então a validação falha apontando `title` como obrigatório.
- **C2.a** — Dado um objeto com `title` tendo 121 code points, quando se valida contra o schema de criação, então a validação falha apontando o limite de `title`.
- **C2.b** — Dado um objeto com `title` tendo exatamente 120 code points, quando se valida contra o schema de criação, então a validação passa.
- **C3.a** — Dado um objeto válido de criação com `status = "succeeded"` preenchido arbitrariamente, quando se valida contra o schema de criação, então o valor resultante não contém o campo `status`.
- **C4.a** — Dado o valor `"in_progress"`, quando se valida contra o schema de transição de situação, então a validação passa.
- **C4.b** — Dado o valor `"pausada"` (não é uma situação válida), quando se valida contra o schema de transição de situação, então a validação falha.

## Registro da implementação
**Testes**
- `packages/shared/src/schemas/mission.test.ts` — cenários C1.a, C1.b, C2.a, C2.b, C3.a, C4.a, C4.b

**O que foi alterado**
- `packages/shared` passou a exportar `createMissionSchema` (valida `title` obrigatório, com `trim()` e limite de 120 code points, ignorando qualquer `status` enviado) e `missionStatusSchema` (enum com as 5 situações válidas de missão), além dos tipos inferidos `CreateMissionInput` e `MissionStatus`.

**Desvios do planejado**
- Correção de revisão: `codePointLength` e `requiredText` foram extraídos para `packages/shared/src/schemas/text.ts` e importados em `hero.ts` e `mission.ts`, removendo a duplicação apontada como bloqueante.
