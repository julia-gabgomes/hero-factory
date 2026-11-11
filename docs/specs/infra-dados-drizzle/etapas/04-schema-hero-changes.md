# 04 — Criar o schema de hero_changes

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** 01 (schema de heroes)

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
`apps/api` passa a ter o schema da tabela `hero_changes` (histórico de alterações do herói: quando, campo, valor antigo, valor novo), com o índice decidido em `apps/api/CLAUDE.md`, e a migration correspondente.

## Critérios de aceite
- [x] C1 — `pnpm db:migrate` aplica a migration da tabela `hero_changes` sem erro, em sequência à de `heroes`.
- [x] C2 — A tabela tem as colunas `id`, `hero_id`, `event`, `field`, `old_value`, `new_value`, `created_at`.
- [x] C3 — `event` é restrito aos 5 valores válidos (`created`, `updated`, `activated`, `inactivated`, `deleted`).
- [x] C4 — `created_at` é `DATETIME(3)`.
- [x] C5 — Existe um índice cobrindo `(hero_id, created_at, id)`, nessa ordem de colunas.

## Cenários de teste
- **C1.a** — Dado o banco limpo (via Testcontainers), quando se aplicam as migrations em sequência (heroes, hero_changes), então a tabela `hero_changes` passa a existir sem erro.
- **C2.a** — Dado o banco com a migration aplicada, quando se insere uma linha com `hero_id`, `event`, `field`, `old_value`, `new_value` e `created_at` preenchidos, então a inserção é aceita e a leitura devolve os mesmos valores.
- **C3.a** — Dado o banco com a migration aplicada, quando se insere uma linha com `event = "renomeado"` (valor inválido), então o banco rejeita a inserção.
- **C4.a** — Dado o arquivo de migration SQL gerado, quando se lê a definição de `created_at`, então ela é `DATETIME(3)`.
- **C5.a** — Dado o arquivo de migration SQL gerado, quando se lê os índices da tabela `hero_changes`, então existe um índice cobrindo exatamente `(hero_id, created_at, id)`, nessa ordem.

## Registro da implementação
**Testes**
- `apps/api/test/hero-changes-schema.test.ts` — cenários C1.a, C2.a, C3.a, C4.a, C5.a

**O que foi alterado**
- O schema Drizzle `apps/api/src/db/schema/hero_changes.ts` passou a existir, mapeando a tabela `hero_changes` (histórico de alterações do herói), e a migration correspondente foi gerada e aplicada em sequência à de `heroes`.

**Desvios do planejado**
- Nenhum. A migration gerada pelo `drizzle-kit` foi revisada à mão para acrescentar `CHARACTER SET ascii COLLATE ascii_bin` em `id` e `hero_id` (consistente com `heroes.id` e com o padrão já usado em `missions`/`mission_heroes`, necessário para o MySQL aceitar a foreign key) e `CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci` nas colunas de texto (`field`, `old_value`, `new_value`), seguindo o mesmo padrão das migrations anteriores.
