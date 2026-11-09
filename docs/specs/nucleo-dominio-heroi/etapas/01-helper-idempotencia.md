# 01 — Criar o helper de idempotência genérica

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** nenhuma

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
`apps/api` passa a ter `withIdempotency(db, { scope, key, requestHash }, fn)` (`http/idempotency.ts`), reutilizável por qualquer módulo que precise de criação idempotente. Ele roda `fn` dentro de uma transação: insere a chave em `idempotency_keys` (PK `(scope, key)`), executa `fn`, grava a resposta e confirma. Testado isoladamente, com uma `fn` de exemplo, antes de qualquer rota de herói existir.

## Critérios de aceite
- [x] C1 — Duas chamadas concorrentes com o mesmo `scope`/`key`/`requestHash` resultam em `fn` executado uma vez só; a chamada que perdeu a corrida recebe a mesma resposta, marcada como réplica.
- [x] C2 — A mesma chave usada de novo com um `requestHash` diferente lança um erro identificável como `IDEMPOTENCY_KEY_MISMATCH`.
- [x] C3 — Uma chave nunca usada executa `fn` normalmente e grava a resposta, sem ser tratada como réplica.
- [x] C4 — Se `fn` lança um erro, a chave não fica salva (o rollback desfaz o `INSERT` da chave), permitindo tentar de novo com a mesma chave depois.

## Cenários de teste
- **C1.a** — Dado duas chamadas de `withIdempotency` com o mesmo `scope`, `key` e `requestHash`, disparadas ao mesmo tempo por uma barreira, quando ambas terminam, então `fn` foi chamado exatamente uma vez e as duas chamadas devolvem o mesmo resultado; uma delas é identificável como réplica (ex. uma flag `replayed: true` no retorno).
- **C2.a** — Dado uma chave já usada com `requestHash = "abc"`, quando se chama `withIdempotency` de novo com a mesma chave e `requestHash = "xyz"`, então a chamada lança um erro com o código `IDEMPOTENCY_KEY_MISMATCH`.
- **C3.a** — Dado uma chave nunca usada, quando se chama `withIdempotency`, então `fn` é executado e o resultado dele é devolvido, sem a flag de réplica.
- **C4.a** — Dado uma `fn` que lança um erro depois de fazer uma escrita de teste na mesma transação, quando `withIdempotency` é chamado, então a chamada propaga o erro, a escrita de teste não persiste (rollback) e a chave não fica em `idempotency_keys`; uma chamada seguinte com a mesma chave consegue executar `fn` de novo normalmente.

## Registro da implementação
**Testes**
- `apps/api/test/idempotency.test.ts` — cenários C1.a, C2.a, C3.a, C4.a

**O que foi alterado**
- `apps/api/src/http/idempotency.ts` passa a existir: expõe `withIdempotency(db, { scope, key, requestHash }, fn)` e `IdempotencyKeyMismatchError`, prontos para qualquer rota de criação usar quando a tarefa chegar lá.

**Desvios do planejado**
- A assinatura final de `withIdempotency` recebe `db` como primeiro parâmetro, seguido por um objeto `{ scope, key, requestHash }` e por `fn`, em vez de `(scope, key, requestHash, fn)` como citado na seção "O que esta etapa entrega". É a assinatura que o teste já trava (ver comentário no topo de `idempotency.test.ts`), então a implementação seguiu o teste.
- O MySQL (via mysql2/Drizzle) embrulha o erro de chave duplicada numa `DrizzleQueryError`, com o `code: "ER_DUP_ENTRY"` original disponível em `error.cause`, não na própria instância lançada. A detecção de duplicidade checa os dois lugares.
- 5 erros de lint (`@typescript-eslint/require-await`) no arquivo de teste travado foram corrigidos (remoção de `async` desnecessário em funções sem `await`, usando `Promise.resolve(...)`), sem alterar nenhuma asserção.

**Sugestões da revisão (aplicadas)**
- `code` de `IdempotencyKeyMismatchError` agora usa `satisfies ErrorCode` (de `@hero-factory/shared`) em vez de string literal solta.
- Comentário explicando por que o branch defensivo de "chave não encontrada após conflito" é seguro sem teste próprio.
