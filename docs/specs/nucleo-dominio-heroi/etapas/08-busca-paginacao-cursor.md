# 08 — Buscar heróis com paginação por cursor

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** 04 (listar heróis)

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
`GET /heroes` passa a aceitar `q` (busca por `name`/`nickname`, qualquer parte do texto, sem diferenciar maiúsculas/acentos) e paginação real por cursor opaco (base64url de `created_at` + `id`), em vez da página única da etapa 04. Os caracteres `%`, `_` e `\` digitados na busca são escapados antes de montar o `LIKE`.

## Critérios de aceite
- [x] C1 — `GET /heroes?q=joao` encontra heróis cujo `name` ou `nickname` contém "João" (ou variações de caixa/acento), em qualquer posição do texto.
- [x] C2 — Buscar por um termo contendo `%`, `_` ou `\` trata esses caracteres como texto literal, não como operadores do `LIKE` (um herói com `nickname` contendo `%` literal só aparece se o termo buscado tiver esse `%`).
- [x] C3 — Com muitos heróis criados com o mesmo `created_at`, paginar por todas as páginas usando `next_cursor` percorre cada herói exatamente uma vez (sem repetir nem pular nenhum).
- [x] C4 — A última página não tem `next_cursor` (ou ele é `null`); a primeira página não tem `prev_cursor` útil.

## Cenários de teste
- **C1.a** — Dado um herói com `name = "João Silva"`, quando se chama `GET /heroes?q=joao`, então o herói aparece no resultado.
- **C1.b** — Dado um herói com `nickname = "Capitão"`, quando se chama `GET /heroes?q=capitao`, então o herói aparece no resultado (sem acento no termo buscado).
- **C2.a** — Dado um herói com `nickname = "100% Herói"` e outro com `nickname = "Herói Comum"`, quando se chama `GET /heroes?q=100%25` (ou o `%` passado como texto normal do campo de busca), então só o primeiro herói aparece.
- **C3.a** — Dados 15 heróis inseridos com o mesmo `created_at` (forçado via factory de teste, não pelo relógio real), quando se percorre `GET /heroes` página por página seguindo `next_cursor` até ele vir vazio, então a união de todas as páginas tem exatamente os 15 heróis, cada um aparecendo uma única vez.
- **C4.a** — Dado menos de 10 heróis no banco, quando se chama `GET /heroes`, então a resposta não tem `next_cursor` (ou ele é `null`).

## Registro da implementação
**Testes**
- `apps/api/test/modules/heroes/search-paginate-heroes.test.ts` — cenários C1.a, C1.b, C2.a, C3.a, C4.a

**O que foi alterado**
- `GET /heroes` passou a aceitar `?q=` para buscar por `name` ou `nickname` (sem diferenciar maiúsculas/acentos, graças à collation do banco) e `?cursor=` para avançar para a próxima página, em vez de só devolver a primeira página.
- A resposta passa a trazer `next_cursor` preenchido sempre que há mais heróis depois da página atual, e `null` quando a página é a última.

**Desvios do planejado**
- Nenhum. `prev_cursor` continua `null`, como previsto: nenhum cenário de teste exige navegação para a página anterior.

**Sugestões da revisão**
- `apps/api/src/modules/heroes/repository.ts` — a checagem `if (searchCondition !== undefined)` é código morto (um `or()` com dois argumentos definidos nunca devolve `undefined`); pode ser simplificada, sem efeito funcional.
