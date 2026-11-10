# Desempenho

Este documento registra a medição de desempenho exigida pelo README: a
primeira página e a busca de heróis respondem em menos de 0,3s (p95) com
100 mil heróis no banco.

Medido de ponta a ponta contra a topologia real do Docker Compose (Nginx →
`api1`/`api2` → MySQL), com os 100 000 heróis do seed, 5 usuários
concorrentes por cenário e threshold `p(95) < 300ms`. **Todos os cenários
passaram**, mas `search_rare` e `search_miss` passaram raspando (perto de
290-299ms) — ver a seção de `EXPLAIN ANALYZE` para o motivo.

## Máquina

- macOS, Apple Silicon (arm64), Docker Desktop 28.0.4.
- Docker com 8 CPUs e ~7,9 GB de RAM alocados (`docker info --format
  '{{.NCPU}} CPUs, {{.MemTotal}} bytes RAM'`).

## Como reproduzir

```bash
cp .env.example .env
SEED_ON_START=true docker compose up --build -d
# aguardar o serviço `migrate` terminar (docker compose ps) antes de rodar o benchmark
docker compose --profile bench run --rm k6
```

O benchmark roda contra o Nginx (`http://nginx` dentro da rede do compose),
mesma borda que a tela usa, nos cinco cenários de `bench/heroes.js`:

| Cenário | O que mede |
|---|---|
| `first_page` | `GET /api/heroes` sem filtro, primeira página |
| `search_hit` | `GET /api/heroes?q=thor` — termo comum (~5% dos heróis) |
| `search_rare` | `GET /api/heroes?q=zorblatt` — termo em exatamente um herói |
| `search_miss` | `GET /api/heroes?q=nonexistentus` — termo que não existe |
| `deep_cursor` | Página bem adiante na paginação por cursor (não a primeira) |

## Resultado (p50 / p95 / p99)

Saída real de `docker compose --profile bench run --rm k6` (ver `http_req_duration`
por `scenario`/`step`):

| Cenário | p50 (ms) | p95 (ms) | p99 (ms) | Passou o threshold (p95 < 300ms)? |
|---|---|---|---|---|
| `first_page` | 4,3 | 5,8 | 7,0 | Sim |
| `search_hit` | 5,7 | 10,3 | 19,1 | Sim |
| `search_rare` | 282,1 | 290,4 | 294,3 | Sim (perto do limite) |
| `search_miss` | 287,3 | 294,3 | 296,9 | Sim (perto do limite) |
| `deep_cursor` (última página) | 6,4 | 7,8 | 8,0 | Sim |

`first_page`, `search_hit` e `deep_cursor` sobram de margem (de 1 a 2 ordens
de grandeza abaixo do limite). `search_rare` e `search_miss` passam, mas sem
muita margem — ver o motivo abaixo.

## `EXPLAIN ANALYZE` das consultas centrais

### Primeira página (`GET /heroes`)

```sql
EXPLAIN ANALYZE
SELECT id, nickname, avatar_url, is_active, name, universe, main_power,
       date_of_birth, deleted_at, version, created_at, updated_at
FROM heroes
WHERE deleted_at IS NULL
ORDER BY created_at DESC, id DESC
LIMIT 11;
```

```
-> Limit: 11 row(s)  (actual time=0.394..0.4 rows=11 loops=1)
    -> Filter: (heroes.deleted_at is null)  (actual time=0.098..0.103 rows=11 loops=1)
        -> Index lookup on heroes using heroes_deleted_at_created_at_id_name_nickname_idx
           (deleted_at=NULL) (reverse)  (actual time=0.0914..0.0959 rows=11 loops=1)
```

Usa o índice `heroes_deleted_at_created_at_id_name_nickname_idx` direto, sem
`filesort`, e para na 11ª linha (`LIMIT`). Por isso o tempo é da ordem de
microssegundos — a concorrência de 5 usuários não muda isso.

### Busca com acerto comum (`GET /heroes?q=thor`, ~5% dos heróis)

```sql
EXPLAIN ANALYZE
SELECT id, nickname, avatar_url, is_active, name, universe, main_power,
       date_of_birth, deleted_at, version, created_at, updated_at
FROM heroes
WHERE deleted_at IS NULL
  AND (name LIKE '%thor%' OR nickname LIKE '%thor%')
ORDER BY created_at DESC, id DESC
LIMIT 11;
```

```
-> Limit: 11 row(s)  (actual time=0.0496..0.907 rows=11 loops=1)
    -> Filter: ((heroes.deleted_at is null) and
               ((heroes.`name` like '%thor%') or (heroes.nickname like '%thor%')))
       (actual time=0.0489..0.906 rows=11 loops=1)
        -> Index lookup on heroes using heroes_deleted_at_created_at_id_name_nickname_idx
           (deleted_at=NULL) (reverse)  (actual time=0.046..0.34 rows=201 loops=1)
```

Ainda usa o índice para percorrer em ordem (sem `filesort`): como "thor"
aparece em ~5% dos heróis, o MySQL só precisa examinar 201 linhas (não as
100 000) antes de juntar as 11 do `LIMIT` — daí o `search_hit` ficar na
casa de milissegundos mesmo sob carga.

### Busca rara e busca sem resultado (`?q=zorblatt`, `?q=nonexistentus`)

Mesma consulta, trocando o termo. A diferença contra `search_hit` está no
`rows` do passo de índice:

```
-- q=zorblatt (1 herói em 100 000, o mais antigo pela ordenação created_at/id)
-> Limit: 11 row(s)  (actual time=113..113 rows=1 loops=1)
    -> Filter: (...)  (actual time=113..113 rows=1 loops=1)
        -> Index lookup ... (reverse)  (actual time=0.0467..99.1 rows=100000 loops=1)

-- q=nonexistentus (0 heróis)
-> Limit: 11 row(s)  (actual time=99.4..99.4 rows=0 loops=1)
    -> Filter: (...)  (actual time=99.4..99.4 rows=0 loops=1)
        -> Index lookup ... (reverse)  (actual time=0.0309..86.8 rows=100000 loops=1)
```

Sem um match (ou com um único match perto do fim do índice), o `LIMIT`
nunca para a varredura mais cedo: o MySQL examina as **100 000 linhas**
antes de responder, mesmo sem `filesort` e usando o índice. Isso é o limite
real do `LIKE '%termo%'` sem FULLTEXT já previsto em `docs/decisions.md`
("Simples e suficiente para 100k (medido). Caminho de evolução
documentado"): "suficiente" aqui significa "passa o threshold com 5
usuários concorrentes", não "sobra margem". Se o volume crescer além de
100k, ou a concorrência de busca aumentar, o próximo passo é o FULLTEXT com
ngram já citado no README — não implementado nesta fase por ser o limite
conhecido e aceito, não um bug.
