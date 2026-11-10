# 05 — Criar o schema de idempotency_keys

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** 01 (cliente Drizzle e Testcontainers)

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
`apps/api` passa a ter o schema da tabela `idempotency_keys` (chave de idempotência por escopo, hash do pedido, resposta salva), com PK composta `(scope, key)` decidida em `apps/api/CLAUDE.md`, e a migration correspondente. Com esta etapa, todas as 5 tabelas da tarefa existem e `docker compose up -d mysql && pnpm db:migrate` aplica tudo do zero, sem erro.

## Critérios de aceite
- [x] C1 — `pnpm db:migrate` aplica a migration da tabela `idempotency_keys` sem erro, em sequência às demais.
- [x] C2 — A PK da tabela é composta por `(scope, key)`.
- [x] C3 — A tabela tem as colunas `request_hash`, `response_status`, `response_body`, `created_at`.
- [x] C4 — `created_at` é `DATETIME(3)`.
- [x] C5 — A PK composta impede duas linhas com o mesmo `(scope, key)`.
- [ ] C6 — Com todas as 5 migrations aplicadas em sequência num banco vazio, `pnpm db:migrate` não produz erro. (Verificação manual — já executada com sucesso durante a implementação; checkbox fica para confirmação final do usuário, junto com as demais verificações manuais da tarefa.)

## Cenários de teste
- **C1.a** — Dado o banco limpo (via Testcontainers), quando se aplica a migration de `idempotency_keys`, então a tabela passa a existir sem erro.
- **C2.a** — Dado o arquivo de migration SQL gerado, quando se lê a PK da tabela `idempotency_keys`, então ela é composta por `(scope, key)`.
- **C3.a** — Dado o banco com a migration aplicada, quando se insere uma linha com `scope`, `key`, `request_hash`, `response_status`, `response_body` e `created_at` preenchidos, então a inserção é aceita e a leitura devolve os mesmos valores.
- **C4.a** — Dado o arquivo de migration SQL gerado, quando se lê a definição de `created_at`, então ela é `DATETIME(3)`.
- **C5.a** — Dado uma linha já existente com `scope = "heroes"` e `key = "abc"`, quando se tenta inserir outra linha com o mesmo `scope` e `key`, então o banco rejeita por chave duplicada.
- **C6.a (verificação manual)** — Com um banco MySQL vazio (`docker compose up -d mysql` após `docker compose down -v`), rodar `pnpm db:migrate` → as 5 tabelas (`heroes`, `missions`, `mission_heroes`, `hero_changes`, `idempotency_keys`) são criadas sem erro.

## Registro da implementação
**Testes**
- `apps/api/test/idempotency-keys-schema.test.ts` — cenários C1.a, C2.a, C3.a, C4.a, C5.a

**O que foi alterado**
- O schema Drizzle da tabela `idempotency_keys` foi criado em `apps/api/src/db/schema/idempotency_keys.ts`, com PK composta `(scope, key)` e as colunas `request_hash`, `response_status`, `response_body` e `created_at` (`DATETIME(3)`). A migration correspondente (`0004_black_sinister_six.sql`) foi gerada com `pnpm db:generate` e revisada à mão para aplicar `CHARACTER SET ascii COLLATE ascii_bin` em `key` e `request_hash` (mesmo padrão dos demais IDs/hashes do projeto) e `utf8mb4_0900_ai_ci` em `scope` e `response_body`. Com esta etapa, as 5 tabelas da tarefa existem e `pnpm db:migrate` aplica tudo em sequência num banco vazio.
