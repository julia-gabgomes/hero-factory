# 02 — Criar a tabela de códigos de erro

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** nenhuma

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
`packages/shared` passa a ter, em `errors/codes.ts`, a tabela que liga cada código de erro estável da API ao seu status HTTP, igual à tabela do `CLAUDE.md`, pronta para ser usada pela API ao montar o envelope de erro e pela tela ao reagir a cada código.

## Critérios de aceite
- [x] C1 — Existe uma entrada para cada um dos 9 pares código/status da tabela do `CLAUDE.md`: `BAD_REQUEST` (400), `VALIDATION_ERROR` (422), `NOT_FOUND` (404), `VERSION_CONFLICT` (409), `SCHEDULE_CONFLICT` (409), `INVALID_STATE` (409), `DUPLICATE_HERO` (409), `IDEMPOTENCY_KEY_MISMATCH` (422), `INTERNAL_ERROR` (500).
- [x] C2 — Não existe nenhuma entrada além dessas 9.
- [x] C3 — O tipo dos códigos é uma união literal (não `string` genérico), para que usar um código inexistente seja erro de tipo.

## Cenários de teste
- **C1.a** — Dado o módulo `errors/codes.ts`, quando se lê o status associado a cada um dos 9 códigos listados, então cada um corresponde exatamente ao status da tabela do `CLAUDE.md`.
- **C2.a** — Dado o módulo `errors/codes.ts`, quando se conta as chaves da tabela, então o total é exatamente 9.
- **C3.a** — Dado o tipo exportado para o código de erro, quando se tenta atribuir uma string arbitrária fora da lista a uma variável desse tipo, então o `tsc` rejeita (verificado por um teste de tipo ou por uma função que só aceita o tipo literal).

## Registro da implementação
**Testes**
- `packages/shared/src/errors/codes.test.ts` — cenários C1.a, C2.a, C3.a

**O que foi alterado**
- `packages/shared` passou a exportar, em `errors/codes.ts`, a tabela `errorStatusByCode` (código → status HTTP) e o tipo `ErrorCode`, prontos para a API montar o envelope de erro e a tela reagir a cada código.
