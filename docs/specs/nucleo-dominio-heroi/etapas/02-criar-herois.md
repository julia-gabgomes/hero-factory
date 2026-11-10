# 02 — Criar heróis

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** 01 (helper de idempotência)

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
`POST /heroes` passa a existir: valida o corpo com `createHeroSchema` (`packages/shared`), exige `Idempotency-Key`, usa `withIdempotency` (etapa 01) para garantir que criar duas vezes resulta em um herói só, e grava o herói com `id` (UUIDv7), `version = 1`, `is_active = true`, `created_at`/`updated_at` gerados pelo servidor.

## Critérios de aceite
- [x] C1 — `POST /heroes` sem o header `Idempotency-Key` dá 400 `BAD_REQUEST`.
- [x] C2 — `POST /heroes` com corpo válido cria o herói e devolve 201 com `id`, `version = 1`, `is_active = true`, `created_at`/`updated_at` preenchidos pelo servidor.
- [x] C3 — Dois `POST /heroes` concorrentes com a mesma `Idempotency-Key` e o mesmo corpo resultam em exatamente um herói criado no banco; a resposta da chamada que perdeu a corrida tem o header `Idempotent-Replayed: true`.
- [x] C4 — A mesma `Idempotency-Key` usada com um corpo diferente do da primeira vez dá 422 `IDEMPOTENCY_KEY_MISMATCH`.
- [x] C5 — `id`, `created_at`, `updated_at`, `version` e `deleted_at` enviados no corpo são ignorados; o herói criado usa só os valores definidos pelo servidor.
- [x] C6 — Um campo obrigatório (`name`, `nickname`, `universe`, `main_power`, `date_of_birth`) vazio ou só com espaços dá 422 `VALIDATION_ERROR` com `fields` apontando o campo.
- [x] C7 — `date_of_birth` no futuro (segundo a regra UTC+14) dá 422 `VALIDATION_ERROR`.

## Cenários de teste
- **C1.a** — Dado um corpo válido de criação, quando se chama `POST /heroes` sem o header `Idempotency-Key`, então a resposta é 400 com `error.code = "BAD_REQUEST"`.
- **C2.a** — Dado um corpo válido com todos os campos obrigatórios e um `Idempotency-Key` novo, quando se chama `POST /heroes`, então a resposta é 201, o herói criado tem `version = 1`, `is_active = true`, e `created_at`/`updated_at` no formato ISO 8601 UTC.
- **C3.a** — Dado um corpo válido e uma `Idempotency-Key` X, quando se disparam dois `POST /heroes` concorrentes com X e o mesmo corpo (barreira), então existe exatamente um herói no banco com os dados desse corpo, e uma das duas respostas tem `Idempotent-Replayed: true`.
- **C4.a** — Dado um `POST /heroes` já respondido com a `Idempotency-Key` X, quando se chama `POST /heroes` de novo com X mas um corpo diferente, então a resposta é 422 com `error.code = "IDEMPOTENCY_KEY_MISMATCH"`.
- **C5.a** — Dado um corpo de criação com `id`, `created_at`, `updated_at`, `version` e `deleted_at` preenchidos arbitrariamente, quando se chama `POST /heroes`, então o herói criado ignora esses valores (novo `id` gerado pelo servidor, `version = 1`, `deleted_at` nulo).
- **C6.a** — Dado um corpo com `nickname = "   "` (só espaços), quando se chama `POST /heroes`, então a resposta é 422 com `fields.nickname` preenchido.
- **C7.a** — Dado um corpo com `date_of_birth` igual a uma data futura (UTC+14), quando se chama `POST /heroes`, então a resposta é 422 com `fields.date_of_birth` preenchido.

## Registro da implementação
**Testes**
- `apps/api/test/modules/heroes/create-hero.test.ts` — cenários C1.a, C2.a, C3.a, C4.a, C5.a, C6.a, C7.a

**O que foi alterado**
- `POST /heroes` passou a existir: cria um herói a partir do corpo validado (`createHeroSchema`), exigindo o header `Idempotency-Key`. Chamadas concorrentes ou repetidas com a mesma chave e o mesmo corpo recebem a mesma resposta, com `Idempotent-Replayed: true` na que não criou o herói.

**Desvios do planejado**
- `routes.ts` valida a presença do header `Idempotency-Key` manualmente (fora do schema Zod do corpo), porque validar o header via schema do Fastify faria o erro cair no branch `VALIDATION_ERROR` (422) do error handler, e o critério C1 exige 400 `BAD_REQUEST`.
- `heroRoutes` é uma função síncrona (não `async`), porque um `async` sem `await` violava `@typescript-eslint/require-await`; o Fastify aceita plugins síncronos que não retornam promise normalmente.
- 6 erros de lint (`@typescript-eslint/no-unnecessary-type-assertion`) no arquivo de teste travado foram corrigidos (`response.json() as {...}` → `response.json<{...}>()`), sem alterar nenhuma asserção.

**Correção pós-revisão:** `IdempotencyKeyMismatchError` não era subclasse de `AppError`, o que fez a primeira versão da implementação adicionar um `instanceof IdempotencyKeyMismatchError` dedicado em `http/error-handler.ts` — acoplando a peça genérica de erro HTTP a um módulo específico (`idempotency.ts`). A revisão apontou isso como bloqueante: cada novo erro de módulo repetiria esse padrão, e `error-handler.ts` acabaria conhecendo todos os módulos do sistema um por um. Corrigido fazendo `IdempotencyKeyMismatchError` estender `AppError` (como `apps/api/CLAUDE.md` já determina) e removendo o branch especial; o erro agora cai no branch genérico `instanceof AppError`, sem mudar o comportamento observável (status 422, mesmo código, mesma mensagem).
