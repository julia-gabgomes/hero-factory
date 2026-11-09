# 05 — Criar os schemas de herói

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** 01 (limites), 03 (validação de data não futura)

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
`packages/shared` passa a ter, em `schemas/hero.ts`, o schema de criação e o schema de atualização de herói: campos obrigatórios (`name`, `nickname`, `universe`, `main_power`, `date_of_birth`) e opcional (`avatar_url`), texto `trim()`-ado antes de validar, limites de caracteres vindos de `limits.ts`, `date_of_birth` validado como string `"YYYY-MM-DD"` não futura (usando a função da etapa 03), e os campos controlados pelo servidor ignorados mesmo se enviados.

## Critérios de aceite
- [x] C1 — O schema de criação exige `name`, `nickname`, `universe`, `main_power` e `date_of_birth`, e aceita a ausência de `avatar_url`.
- [x] C2 — Um campo obrigatório preenchido só com espaços é tratado como vazio e rejeitado com erro de obrigatório.
- [x] C3 — O texto de cada campo é salvo sem espaços nas pontas (o valor validado já vem com `trim()` aplicado).
- [x] C4 — Cada campo de texto respeita o limite de `limits.ts` (ex.: `name` até 120 code points); um valor acima do limite é rejeitado.
- [x] C5 — `date_of_birth` é validado como string no formato `"YYYY-MM-DD"`; uma data futura (segundo a regra UTC+14 da etapa 03) é rejeitada.
- [x] C6 — Campos controlados pelo servidor (`id`, `created_at`, `updated_at`, `deleted_at`, `version`) são ignorados pelo schema de criação, mesmo se vierem no objeto de entrada.
- [x] C7 — O schema de atualização aceita os mesmos campos de forma parcial (nenhum é obrigatório na atualização), mas aplica as mesmas regras de `trim()`, limite e data não futura a qualquer campo enviado.
- [x] C8 — `avatar_url`, quando enviado, só é aceito se começar com `http://`, `https://` ou `/uploads/`; qualquer outro valor é rejeitado.

## Cenários de teste
- **C1.a** — Dado um objeto com todos os campos obrigatórios preenchidos e sem `avatar_url`, quando se valida contra o schema de criação, então a validação passa.
- **C1.b** — Dado um objeto sem o campo `name`, quando se valida contra o schema de criação, então a validação falha apontando `name` como obrigatório.
- **C2.a** — Dado um objeto com `nickname = "   "` (só espaços), quando se valida contra o schema de criação, então a validação falha apontando `nickname` como obrigatório/vazio.
- **C3.a** — Dado um objeto com `name = "  Clark Kent  "`, quando se valida contra o schema de criação, então o valor resultante é `"Clark Kent"`, sem espaços nas pontas.
- **C4.a** — Dado um objeto com `name` tendo 121 code points, quando se valida contra o schema de criação, então a validação falha apontando o limite de `name`.
- **C4.b** — Dado um objeto com `name` tendo exatamente 120 code points, quando se valida contra o schema de criação, então a validação passa.
- **C5.a** — Dado um objeto com `date_of_birth = "2026-11-09"` e um relógio falso em que essa data não é futura (UTC+14), quando se valida contra o schema de criação, então a validação passa.
- **C5.b** — Dado um objeto com `date_of_birth` igual a uma data futura segundo a regra UTC+14, quando se valida contra o schema de criação, então a validação falha apontando `date_of_birth` como inválido.
- **C6.a** — Dado um objeto válido de criação com `id`, `created_at`, `updated_at`, `deleted_at` e `version` preenchidos arbitrariamente, quando se valida contra o schema de criação, então o valor resultante não contém nenhum desses campos.
- **C7.a** — Dado um objeto com só `nickname` preenchido, quando se valida contra o schema de atualização, então a validação passa e os demais campos ficam ausentes (não exigidos).
- **C7.b** — Dado um objeto de atualização com `universe = "   "` (só espaços), quando se valida contra o schema de atualização, então a validação falha do mesmo jeito que na criação.
- **C8.a** — Dado um objeto com `avatar_url = "https://exemplo.com/avatar.png"`, quando se valida contra o schema de criação, então a validação passa.
- **C8.b** — Dado um objeto com `avatar_url = "/uploads/avatar.png"`, quando se valida contra o schema de criação, então a validação passa.
- **C8.c** — Dado um objeto com `avatar_url = "ftp://exemplo.com/avatar.png"`, quando se valida contra o schema de criação, então a validação falha apontando `avatar_url` como inválido.

## Registro da implementação
**Testes**
- `packages/shared/src/schemas/hero.test.ts` — cenários C1.a, C1.b, C2.a, C3.a, C4.a, C4.b, C5.a, C5.b, C6.a, C7.a, C7.b, C8.a, C8.b, C8.c

**O que foi alterado**
- `packages/shared` passou a exportar `createHeroSchema` e `updateHeroSchema`, usados por quem valida dados de herói (API e, depois, formulários da tela) para garantir os campos obrigatórios, o trim e o limite de caracteres, e a data de nascimento não futura.

**Desvios do planejado**
- Na primeira volta desta etapa, a validação de formato de `avatar_url` (apenas `http`/`https` ou URL de `/uploads/`) não tinha sido incluída, porque não constava nos critérios de aceite originais (lacuna da divisão em etapas, não da implementação). Acrescentado como C8 e cenários C8.a-c; a validação de formato foi implementada em seguida (`optionalAvatarUrl` em `hero.ts`, substituindo o antigo `optionalText` para esse campo).

**Sugestões da revisão (todas aplicadas)**
- `date_of_birth` passou a validar calendário real (`isValidCalendarDate`, via `Date.UTC` + getters UTC, sem depender de fuso do processo): `"2024-02-31"` agora é rejeitado.
- `avatar_url = ""` (vazio após trim) agora é tratado como ausente (`undefined`), não como erro de formato.
- `packages/shared/src/index.ts` agora reexporta (`export *`) de `limits.js`, `errors/codes.js`, `dates/not-future.js`, `schemas/common.js`, `schemas/hero.js` e `schemas/mission.js`; confirmado que não há colisão de nomes entre os módulos.

**Correção pós-revisão final:** `updateHeroSchema` não exigia `version`, campo exigido pelo CLAUDE.md §3.3 no corpo do PATCH /heroes/:id para o lock otimista ("Edição simultânea"). Corrigido para `createHeroSchema.partial().extend({ version: z.number().int() })`. O teste pré-existente C7.a precisou de ajuste de payload (`{ nickname: "Super-Homem", version: 1 }` em vez de só `{ nickname: "Super-Homem" }`) para continuar válido com `version` obrigatório, sem perder a asserção original de que os demais campos continuam opcionais.
