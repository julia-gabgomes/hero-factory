# 03 — Criar o schema de mission_heroes

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** 01 (schema de heroes), 02 (schema de missions)

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
`apps/api` passa a ter o schema da tabela de associação `mission_heroes` (escalação de heróis em missões), com PK composta `(mission_id, hero_id)` e o índice decidido em `apps/api/CLAUDE.md`, e a migration correspondente.

## Critérios de aceite
- [x] C1 — `pnpm db:migrate` aplica a migration da tabela `mission_heroes` sem erro, em sequência às de `heroes` e `missions`.
- [x] C2 — A PK da tabela é composta por `(mission_id, hero_id)`.
- [x] C3 — `mission_id` e `hero_id` são chaves estrangeiras de verdade (`REFERENCES`), apontando respectivamente para `missions.id` e `heroes.id`.
- [x] C4 — Existe um índice cobrindo `(hero_id)`.
- [x] C5 — A PK composta impede escalar o mesmo herói duas vezes na mesma missão.

## Cenários de teste
- **C1.a** — Dado o banco limpo (via Testcontainers), quando se aplicam as migrations em sequência (heroes, missions, mission_heroes), então a tabela `mission_heroes` passa a existir sem erro.
- **C2.a** — Dado o arquivo de migration SQL gerado, quando se lê a PK da tabela `mission_heroes`, então ela é composta por `(mission_id, hero_id)`.
- **C3.a** — Dado o arquivo de migration SQL gerado, quando se lê a definição da tabela `mission_heroes`, então existem constraints `FOREIGN KEY` para `mission_id → missions.id` e `hero_id → heroes.id`.
- **C3.b** — Dado o banco com as três migrations aplicadas, quando se insere uma linha em `mission_heroes` com um `hero_id` ou `mission_id` que não existe nas tabelas referenciadas, então o banco rejeita por violação de chave estrangeira.
- **C4.a** — Dado o arquivo de migration SQL gerado, quando se lê os índices da tabela `mission_heroes`, então existe um índice cobrindo `(hero_id)`.
- **C5.a** — Dado uma missão e um herói já escalados (uma linha em `mission_heroes` com esse par), quando se tenta inserir novamente a mesma combinação `(mission_id, hero_id)`, então o banco rejeita por chave duplicada.

## Registro da implementação
**Testes**
- `apps/api/test/mission-heroes-schema.test.ts` — cenários C1.a, C2.a, C3.a, C3.b, C4.a, C5.a

**O que foi alterado**
- O cliente Drizzle passa a reconhecer a tabela `mission_heroes`, usada para escalar heróis em missões: a PK composta `(mission_id, hero_id)` impede duplicidade, e as duas colunas são FKs reais para `missions.id` e `heroes.id`.
- Gerada a migration `0002_dusty_energizer.sql`, revisada à mão para que `mission_id` e `hero_id` usem `CHARACTER SET ascii COLLATE ascii_bin`, igual às colunas `id` de `heroes` e `missions` (mesma convenção de IDs do `apps/api/CLAUDE.md`, que o drizzle-kit não gera automaticamente).

**Desvios do planejado**
- Nenhum.
