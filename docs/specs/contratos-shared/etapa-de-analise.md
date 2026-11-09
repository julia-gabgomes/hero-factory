# Contratos em packages/shared

**Tipo:** funcionalidade · **Status:** concluída · **Atualizada em:** 2026-11-09

## Problema

`packages/shared` ainda não tem nenhum schema, tipo ou código de erro definido. Sem isso, `apps/api` e `apps/web` não têm de onde importar os contratos únicos exigidos pelo `CLAUDE.md` (seção 3.3), o que bloqueia o início de qualquer feature de heróis ou missões.

## Solução

Criar em `packages/shared` os schemas Zod de herói, missão e dos elementos comuns da API (envelope de erro, paginação por cursor, `Idempotency-Key`), a tabela de códigos de erro, os limites de campo compartilhados entre validação e tela, e a função pura `isFutureUtcPlus14`.

**Motivo da escolha:** é a materialização direta das decisões já tomadas no `CLAUDE.md` — não há solução alternativa a avaliar, só a ordem certa de implementar o que já está especificado.

## Escopo

**Inclui:**

- `schemas/common.ts`: envelope de erro único (`error.code`, `message`, `fields`, `details`), forma de paginação por cursor (`{ data, next_cursor, prev_cursor }`) e schema do header `Idempotency-Key` (UUID).
- `schemas/hero.ts`: schema de criação (campos obrigatórios `name`, `nickname`, `universe`, `main_power`, `date_of_birth`; `avatar_url` opcional; `trim()` antes de validar; texto só com espaços conta como vazio; `date_of_birth` como string `"YYYY-MM-DD"`) e schema de atualização, ambos ignorando campos controlados pelo servidor (`id`, `created_at`, `updated_at`, `deleted_at`, `version` na criação).
- `schemas/mission.ts`: schema de criação (`title` obrigatório, limite de 120) e schema de transição de situação (`scheduled` → `in_progress` → `succeeded`/`failed`, mais `cancelled`), ignorando `status` na criação.
- `errors/codes.ts`: tabela código ↔ status HTTP espelhando exatamente a tabela do `CLAUDE.md` (`BAD_REQUEST` 400, `VALIDATION_ERROR` 422, `NOT_FOUND` 404, `VERSION_CONFLICT` 409, `SCHEDULE_CONFLICT` 409, `INVALID_STATE` 409, `DUPLICATE_HERO` 409, `IDEMPOTENCY_KEY_MISMATCH` 422, `INTERNAL_ERROR` 500).
- `dates/not-future.ts`: função pura `isFutureUtcPlus14(dateOfBirth, now)`, sem `new Date("YYYY-MM-DD")`, recebendo o "agora" como parâmetro para ser testável com relógio falso.
- `limits.ts`: um único lugar com os limites de caracteres (`name` 120, `nickname` 60, `universe` 60, `main_power` 80, `avatar_url` 2048, `mission.title` 120), contando code points, usado tanto pelos schemas Zod (`.max()`) quanto disponível para labels de formulário na tela.
- Tipos inferidos (`z.infer`) exportados para cada schema.
- Testes unitários (Vitest) cobrindo schemas, tabela de erros e `isFutureUtcPlus14`, incluindo casos de borda de fuso horário.

**Não inclui:**

- Qualquer rota de API, acesso a banco ou tela (fases seguintes do fluxo).
- Regras que dependem de estado (duplicidade, choque de horário, versão) — aqui só o formato do erro existe; a lógica que dispara cada código é de `apps/api`.

## Critérios de aceite

- [ ] `pnpm --filter shared test` passa.
- [ ] `pnpm --filter shared typecheck` passa, sem `any` e sem `@ts-ignore`.
- [ ] O schema de criação de herói rejeita texto só com espaços nos campos obrigatórios como se fosse vazio, e aceita `avatar_url` ausente.
- [ ] O schema de herói valida `date_of_birth` como string `"YYYY-MM-DD"` e nunca a converte para `Date` do JS em nenhum ponto do pacote.
- [ ] Os limites de `name`, `nickname`, `universe`, `main_power`, `avatar_url` e `mission.title` contam code points (um emoji ou caractere acentuado conta uma vez), não bytes.
- [ ] Campos controlados pelo servidor (`id`, `created_at`, `updated_at`, `deleted_at`, `version` na criação de herói, `status` na criação de missão) são ignorados pelos schemas de criação, mesmo se enviados.
- [ ] `isFutureUtcPlus14` tem teste com relógio falso cobrindo pelo menos: uma data igual a "hoje" em UTC+14 (aceita), uma data um dia depois (rejeita), e uma data que já é "ontem" em UTC-12 mas ainda é "hoje" em UTC+14 (aceita, não pode recusar uma data que é hoje em algum lugar do mundo).
- [ ] `errors/codes.ts` tem uma entrada para cada par status/code da tabela do `CLAUDE.md`, nem mais nem menos.
- [ ] `limits.ts` é a única fonte dos números de limite: os schemas Zod importam dele em vez de repetir o número.

## Decisões

- `date_of_birth` trafega e é validado como string `"YYYY-MM-DD"`, nunca como `Date` do JS — Motivo: evita o erro de fuso horário mais fácil de cometer ao comparar datas sem hora (`CLAUDE.md`, seção "O que NÃO fazer").
- Limite de caracteres conta code points, não bytes — Motivo: exigência explícita do `CLAUDE.md` para não penalizar nomes com acentuação ou caracteres compostos.
- "Não pode ser no futuro" usa UTC+14 como referência de "hoje" — Motivo: é o fuso mais adiantado do mundo; qualquer fuso mais atrasado nunca vê essa data como futura antes dele.
- `isFutureUtcPlus14` recebe o "agora" como parâmetro em vez de ler `Date.now()` internamente — Motivo: é o que permite testar os casos de virada de dia com relógio falso sem mockar módulos globais.

## Detalhes

- [etapas/](etapas/) — etapas de desenvolvimento, uma por arquivo, em ordem; abra ao implementar.
