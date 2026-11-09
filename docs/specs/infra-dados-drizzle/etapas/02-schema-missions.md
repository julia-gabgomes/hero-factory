# 02 — Criar o schema de missions

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** 01 (cliente Drizzle e Testcontainers)

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
`apps/api` passa a ter o schema da tabela `missions` (título, situação, horários) com os tipos e o índice decididos em `apps/api/CLAUDE.md`, e a migration correspondente aplicável via `pnpm db:migrate`.

## Critérios de aceite
- [x] C1 — `pnpm db:migrate` aplica a migration da tabela `missions` sem erro, em sequência à de `heroes`.
- [x] C2 — O SQL gerado cria `title` como `VARCHAR(120)` com collation `utf8mb4_0900_ai_ci`.
- [x] C3 — O SQL gerado cria `status` restrito aos 5 valores válidos (`scheduled`, `in_progress`, `succeeded`, `failed`, `cancelled`).
- [x] C4 — O SQL gerado cria `starts_at` e `ends_at` como `DATETIME(3)`.
- [x] C5 — Existe um índice cobrindo `(status, starts_at, ends_at)`, nessa ordem de colunas.

## Cenários de teste
- **C1.a** — Dado o banco limpo (via Testcontainers), quando se aplicam as migrations em sequência, então a tabela `missions` passa a existir sem erro.
- **C2.a** — Dado o arquivo de migration SQL gerado, quando se lê a definição de `title`, então ela é `VARCHAR(120)` com collation `utf8mb4_0900_ai_ci`.
- **C3.a** — Dado o banco com a migration aplicada, quando se insere uma missão com `status = "pausada"` (valor inválido), então o banco rejeita a inserção.
- **C3.b** — Dado o banco com a migration aplicada, quando se insere uma missão com `status = "scheduled"`, então a inserção é aceita.
- **C4.a** — Dado o arquivo de migration SQL gerado, quando se lê a definição de `starts_at` e `ends_at`, então ambas são `DATETIME(3)`.
- **C5.a** — Dado o arquivo de migration SQL gerado, quando se lê os índices da tabela `missions`, então existe um índice cobrindo exatamente `(status, starts_at, ends_at)`, nessa ordem.

## Registro da implementação
**Testes**
- `apps/api/test/missions-schema.test.ts` — cenários C1.a, C2.a, C3.a, C3.b, C4.a, C5.a

**O que foi alterado**
- Foi criado o schema Drizzle da tabela `missions` (título, situação, horários) e a migration correspondente, que passa a ser aplicada depois da de `heroes` por `pnpm db:migrate`.

**Desvios do planejado**
- O SQL gerado pelo `drizzle-kit generate` não inclui collation explícita (herda o padrão da conexão/banco). Para manter o mesmo padrão explícito já adotado na migration de `heroes`, a migration gerada foi revisada à mão para declarar `id` como `CHARACTER SET ascii COLLATE ascii_bin` e `title` como `CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`, deixando o contrato de collation explícito no SQL em vez de depender do padrão do servidor.
- `status` deriva de `missionStatusSchema.options` (`@hero-factory/shared`), em vez de redeclarar os 5 valores no schema Drizzle. Precisa de um cast para a tupla `[string, ...string[]]` exigida por `mysqlEnum`; a revisão apontou que o cast original passava por `unknown` (apagando a checagem de tipo por completo) e sugeriu um cast único e mais estreito, aplicado diretamente.
