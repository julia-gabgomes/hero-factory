# 04 — Criar os schemas comuns da API

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** 02 (tabela de códigos de erro)

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
`packages/shared` passa a ter, em `schemas/common.ts`, o formato do envelope de erro único da API (usando os códigos da etapa 02), o formato de resposta paginada por cursor (`{ data, next_cursor, prev_cursor }`) e o schema de validação do header `Idempotency-Key` (UUID), com os tipos inferidos exportados para os três.

## Critérios de aceite
- [x] C1 — O schema do envelope de erro valida um objeto com `error.code` (um dos códigos da tabela da etapa 02), `error.message` (string), `error.fields` (mapa campo → mensagem, ou `null`) e `error.details` (opcional).
- [x] C2 — O schema do envelope de erro rejeita um `error.code` que não esteja na tabela de códigos.
- [x] C3 — O schema de paginação por cursor valida um objeto com `data` (array), `next_cursor` (string ou `null`) e `prev_cursor` (string ou `null`), de forma genérica para qualquer tipo de item da lista.
- [x] C4 — O schema do header `Idempotency-Key` valida que o valor é um UUID e rejeita um valor que não seja.

## Cenários de teste
- **C1.a** — Dado um objeto com `error.code = "NOT_FOUND"`, `error.message = "Herói não encontrado"`, `error.fields = null` e `error.details` ausente, quando se valida contra o schema do envelope de erro, então a validação passa.
- **C1.b** — Dado um objeto com `error.fields = { "name": "Campo obrigatório" }`, quando se valida contra o schema do envelope de erro, então a validação passa.
- **C2.a** — Dado um objeto com `error.code = "CODIGO_INEXISTENTE"`, quando se valida contra o schema do envelope de erro, então a validação falha.
- **C3.a** — Dado um objeto com `data = []`, `next_cursor = null` e `prev_cursor = null`, quando se valida contra o schema de paginação (instanciado para qualquer tipo de item), então a validação passa.
- **C3.b** — Dado um objeto com `data` contendo itens e `next_cursor` como uma string opaca, quando se valida, então a validação passa.
- **C4.a** — Dado o valor `"01990000-0000-7000-8000-000000000000"` (UUID válido, estilo UUIDv7), quando se valida contra o schema do header `Idempotency-Key`, então a validação passa.
- **C4.b** — Dado o valor `"abc123"` (não é UUID), quando se valida contra o schema do header `Idempotency-Key`, então a validação falha.

## Registro da implementação
**Testes**
- `packages/shared/src/schemas/common.test.ts` — cenários C1.a, C1.b, C2.a, C3.a, C3.b, C4.a, C4.b

**O que foi alterado**
- `packages/shared` passa a expor, em `schemas/common.ts`, o schema do envelope de erro (`errorEnvelopeSchema`), a função genérica de paginação por cursor (`cursorPageSchema`) e o schema do header `Idempotency-Key` (`idempotencyKeySchema`), cada um com seu tipo inferido (`ErrorEnvelope`, `CursorPage`, `IdempotencyKey`) exportado junto.
- `error.code` do envelope é restrito aos literais de `ErrorCode` (derivados de `errorStatusByCode` da etapa 02), então um código inexistente é rejeitado pelo schema.

**Correção pós-revisão:** o cast usado em `z.enum(Object.keys(errorStatusByCode) as [string, ...string[]])` fazia o tipo inferido perder a união literal (ficava `string` genérico). Corrigido para `as [ErrorCode, ...ErrorCode[]]`, importando `type ErrorCode` de `../errors/codes.js`. Confirmado que `ErrorEnvelope["error"]["code"]` agora é a união dos 9 literais.
