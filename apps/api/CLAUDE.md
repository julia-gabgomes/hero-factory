# CLAUDE.md: API (apps/api)

Regras do backend. Complementa o [`CLAUDE.md` da raiz](../../CLAUDE.md), que define os contratos da API (envelope de erro, limites, formatos, cabeçalhos). Não repita esses contratos aqui: implemente-os.

## Estrutura

```
apps/api/
└─ src/
   ├─ modules/
   │  ├─ heroes/      routes.ts · service.ts · repository.ts · history.ts · tests/*.test.ts
   │  ├─ missions/    routes.ts · service.ts · repository.ts · assignment.ts · tests/*.test.ts
   │  ├─ imports/     routes.ts · service.ts · repository.ts · processor.ts · tests/*.test.ts
   │  └─ uploads/     routes.ts · storage.ts (FileStorage) · tests/*.test.ts
   ├─ db/             client.ts · schema/*.ts (+ *.test.ts colocado) · migrations/ · seed.ts (+ seed.test.ts)
   ├─ http/           errors.ts (AppError) · error-handler.ts · idempotency.ts (+ idempotency.test.ts) · idempotency-cleanup.ts (+ .test.ts) · server-timing.ts (+ .test.ts) · cursor.ts
   ├─ test-support/   helpers só: testcontainers.ts, factories.ts, information-schema.ts — nenhum `*.test.ts` aqui
   ├─ app.ts          buildApp({ db, storage }): composition root, usada também pelos testes
   ├─ server.ts       entrypoint HTTP
   └─ worker.ts       entrypoint do worker de importação
```

**Regra de localização de teste:** todo teste fica na mesma pasta do código que testa. Quando o teste cruza camadas dentro de um módulo (um caso de uso via `app.inject()` que passa por `routes → service → repository`), ele fica em `tests/` dentro do módulo, nomeado pelo comportamento (`create-hero.test.ts`), não por arquivo de camada. Quando há correspondência 1:1 entre teste e arquivo (um schema, um helper de `http/`), o teste fica colocado ao lado, com o mesmo nome. `test-support/` nunca recebe um spec, só infraestrutura de teste compartilhada.

## Camadas

- Direção única: `routes → service → repository → db`.
- **routes:** declaram o schema (Zod do `shared`, via `fastify-type-provider-zod`), traduzem HTTP para chamada de serviço e devolvem o status. Não têm regra de negócio.
- **service:** contém as regras de negócio, as **transações** e os **locks**. É onde mora a lógica de concorrência.
- **repository:** contém o SQL (Drizzle). É o único lugar que escreve nas tabelas do seu módulo.
- Um módulo pode usar o **repository** de outro (por exemplo, `missions` trava a linha do herói via `heroes/repository`), **nunca** as rotas ou o service de outro.
- `buildApp({ db, storage })` monta tudo sem estado global. Os testes criam quantas instâncias quiserem.

## Erros

- Lance `AppError` (ou uma subclasse) no service. O `setErrorHandler` global converte para o envelope da raiz.
- **Nunca** monte uma resposta de erro à mão numa rota.
- Os erros de validação do Zod viram `VALIDATION_ERROR` com `fields`.
- Os erros do MySQL são traduzidos no repository: duplicate key no UNIQUE de herói vira `DUPLICATE_HERO`.
- Num 500, o detalhe (stack, SQL) vai **só para o log**.

## Banco: tipos e convenções

- **IDs:** `CHAR(36) CHARACTER SET ascii COLLATE ascii_bin`, com UUIDv7 gerado na API. É ordenado no tempo, o que ajuda o índice clusterizado do InnoDB e serve de desempate no cursor.
- **Textos:** `VARCHAR(n)` utf8mb4 com os limites da raiz e collation `utf8mb4_0900_ai_ci`.
- **`date_of_birth`:** `DATE`. O mysql2 usa `dateStrings: true`, então a coluna nunca vira `Date` do JS.
- **Timestamps:** `DATETIME(3)` em UTC, com a conexão em `timezone: 'Z'`.
- **"Não futuro":** compare com o hoje em UTC+14 (função pura no `shared`, testada com relógio falso).
- As migrations são geradas pelo drizzle-kit e **revisadas à mão** (índices, collation, colunas geradas).

## Lista, paginação e busca

```sql
SELECT id, nickname, avatar_url, is_active, ...
FROM heroes
WHERE deleted_at IS NULL
  AND (name LIKE :q OR nickname LIKE :q)          -- só quando há busca; '%termo%'
  AND (created_at, id) < (:c_created_at, :c_id)    -- só quando há cursor
ORDER BY created_at DESC, id DESC
LIMIT :limit + 1                                   -- o extra indica se há próxima página
```

- O cursor é base64url de `created_at` e `id` (`http/cursor.ts`). O `prev_cursor` usa a ordem inversa e reverte o resultado.
- **Escape `%`, `_` e `\`** do texto digitado antes de montar o `LIKE`.
- A collation `utf8mb4_0900_ai_ci` cuida de acentos e maiúsculas, sem normalização extra.
- **Índice:** `(deleted_at, created_at, id, name, nickname)`. O MySQL percorre o índice já na ordem da lista e para quando junta `limit + 1` resultados.
- A evolução para volumes maiores (FULLTEXT com ngram) fica citada no README, não implementada.

## Idempotência

- Tabela `idempotency_keys`: PK `(scope, key)`, `request_hash`, `response_status`, `response_body`, `created_at`.
- Use o helper `withIdempotency(scope, key, requestHash, fn)` (`http/idempotency.ts`). Ele roda **na mesma transação** que cria o recurso:
  1. `INSERT` da chave. Um pedido concorrente com a mesma chave **espera o lock da PK**.
  2. Executa `fn` (cria o recurso).
  3. Grava a resposta e confirma a transação.
  - Em *duplicate key*: se o hash for igual, devolve a resposta salva com `Idempotent-Replayed: true`. Se for diferente, lança `IDEMPOTENCY_KEY_MISMATCH`.
  - Se `fn` falha, o rollback apaga a chave e é possível tentar de novo.
- Header ausente num POST de criação resulta em 400 `BAD_REQUEST`.
- Uma limpeza periódica remove chaves com mais de 24 h.

## Edição simultânea: bloqueio otimista

- `heroes.version INT NOT NULL DEFAULT 1`, incrementado a cada alteração.

```sql
UPDATE heroes SET ..., version = version + 1, updated_at = NOW(3)
WHERE id = :id AND version = :version AND deleted_at IS NULL
```

- Se nenhuma linha for afetada, busque o herói: inexistente ou excluído resulta em 404. Caso contrário, `VERSION_CONFLICT` com `details.current`.
- O PATCH aplica **só os campos enviados**.

## Escalação e choque de horário

Tudo numa transação, **sempre nesta ordem de lock** (herói, depois missão), para evitar deadlock:

```sql
SELECT ... FROM heroes   WHERE id = :hero    FOR UPDATE  -- serializa o herói; checa ativo e não excluído
SELECT ... FROM missions WHERE id = :mission FOR UPDATE  -- checa status = 'scheduled'
SELECT m.* FROM mission_heroes mh JOIN missions m ON m.id = mh.mission_id
 WHERE mh.hero_id = :hero
   AND m.status IN ('scheduled', 'in_progress')
   AND m.starts_at < :ends_at AND m.ends_at > :starts_at   -- intervalo semiaberto
INSERT INTO mission_heroes (mission_id, hero_id) ...       -- PK (mission_id, hero_id)
```

- Choque: `SCHEDULE_CONFLICT`, com a missão conflitante em `details` ("Thor já está na missão *Proteger a ponte*, das 10:00 às 12:00").
- Inativar ou excluir um herói também trava a linha dele, então não escapa da escalação concorrente.
- **Proibido** o padrão "verificar e depois inserir" sem o `FOR UPDATE`.
- Índices: `mission_heroes(hero_id)` e `missions(status, starts_at, ends_at)`.

## Ciclo de vida da missão

```
scheduled ──start (≥1 herói)──▶ in_progress ──finish──▶ succeeded | failed
    │                               │
    └────────cancel─────────┬───────┘
                            ▼
                        cancelled
```

- As transições são **manuais** e atômicas: `UPDATE missions SET status = :novo WHERE id = :id AND status = :esperado`. Se nenhuma linha for afetada, `INVALID_STATE`.
- `start` trava a missão com `FOR UPDATE` e conta os heróis, para não perder a corrida contra a remoção do último herói. Remover herói também trava a missão.
- Escalar e tirar heróis só são permitidos em `scheduled`.
- Título e horários são **imutáveis** depois da criação. Valide `ends_at > starts_at`. Início no passado é permitido, porque a situação não depende do relógio.

## Exclusão e histórico

- **Exclusão lógica:** a coluna `deleted_at` é preenchida e **nunca volta a nulo**. O herói excluído some da lista, da busca e do `GET /heroes/:id` (404), e não pode ser editado nem escalado. As missões continuam mostrando o nome dele (a linha do herói continua existindo).
- **Histórico:** tabela `hero_changes (id, hero_id, event, field, old_value, new_value, created_at)`.
  - `event` ∈ `created | updated | activated | inactivated | deleted`.
  - Há **uma linha por campo alterado**. O diff é calculado no **servidor** (`heroes/history.ts`) e gravado **na mesma transação** da alteração.
  - Índice `(hero_id, created_at, id)`, paginação por cursor e filtros por `field` e período.
- As missões do herói vêm de `mission_heroes JOIN missions` (título, período e situação), com cursor e filtro por situação.
- **Nenhum `UPDATE heroes` fora de `heroes/repository`**. Todo caminho de escrita passa pelo service, que audita.

## Herói repetido e seed

- Índice `UNIQUE (name, nickname, date_of_birth)`. Com a collation ai_ci, "João" e "joao" contam como iguais.
- Vale para **todos** os heróis, **inclusive os excluídos**: reimportar não ressuscita ninguém.
- O seed (`db/seed.ts`) gera 100k heróis determinísticos em lotes com `INSERT IGNORE`, por isso é idempotente. Ele roda no serviço `migrate` quando `SEED_ON_START=true`.

## Upload de avatar (opcional 1)

- `POST /uploads/avatars` (multipart):
  - Valida o tipo pelos **magic bytes** (JPEG, PNG ou WebP), nunca pela extensão, e o tamanho (até 2 MB).
  - Normaliza com sharp para WebP 256×256.
  - Grava no volume `uploads` com nome UUIDv7.
  - Devolve `{ "url": "/uploads/<id>.webp" }`.
- A escrita fica atrás da interface `FileStorage` (`uploads/storage.ts`), para trocar por S3 no futuro. Arquivos órfãos ficam documentados.
- Quem serve `/uploads/*` é o Nginx, não a API.

## Importação de CSV (opcional 2)

- `POST /imports` (multipart, com `Idempotency-Key`): valida o cabeçalho (`name,nickname,date_of_birth,universe,main_power,avatar_url`), grava o arquivo no volume, cria uma linha em `import_jobs` (`queued`) e responde **202** com o id.
- `import_jobs`: `status`, `total`, `processed`, `imported`, `duplicated`, `failed`, `locked_by`, `lease_until`, `created_at`.
- O worker (`worker.ts`, serviço próprio no compose, mesma imagem):
  - Pega jobs com `SELECT ... FOR UPDATE SKIP LOCKED` (`queued`, ou `running` com lease vencido).
  - Mantém o lease com *heartbeat*. Um job abandonado é reassumido depois do timeout.
  - Lê em stream (csv-parse) e valida cada linha com o **mesmo schema Zod** da criação.
  - Insere em lotes de cerca de 500 por transação, com `INSERT IGNORE`. Linhas ignoradas contam como `duplicated`.
  - Atualiza os contadores a cada lote e **retoma do último lote confirmado**.
- As linhas recusadas vão para `import_errors (job_id, line, field, message)`, paginadas.
- `GET /imports/:id` lê só do banco, então funciona em qualquer instância. Várias importações podem rodar ao mesmo tempo.

## Desempenho

- `http/server-timing.ts` adiciona `Server-Timing: db;dur=..., total;dur=...` a toda resposta.
- `bench/heroes.js` (k6) roda os cenários `first_page`, `search_hit`, `search_rare`, `search_miss` e `deep_cursor` passando pelo Nginx, com o threshold `p(95)<300` por cenário.
- `docs/performance.md` registra a máquina, o comando, a tabela de p50/p95/p99 e o `EXPLAIN ANALYZE` das consultas.

## Testes da API

**Ferramentas:** Vitest, `app.inject()` e **MySQL real via Testcontainers** (um container por execução, migrations aplicadas, tabelas truncadas entre testes).

**Unitários:** codificação do cursor, máquina de estados da missão, diff do histórico, função "não futuro" (UTC+14).

**Integração obrigatória (um ou mais por regra do README):**
- A criação ignora `id`, `created_at` e `updated_at` enviados. Rejeita campos vazios ou só com espaços (422 com `fields`). Rejeita data futura.
- N POSTs paralelos com o mesmo `Idempotency-Key` resultam em **1 herói**. Mesma chave com outro corpo dá 422.
- Dois PATCHes com a mesma `version`: um dá 200 e o outro 409 com `current`.
- **Escalação simultânea:** duas instâncias `buildApp()` com **pools separados** e o mesmo banco, disparadas juntas por uma barreira. O resultado é exatamente 1 sucesso e 1 `SCHEDULE_CONFLICT`. Encostar nos limites (12h e 12h) **não** é choque.
- Herói inativo ou excluído não pode ser escalado. As transições inválidas da missão dão 409. `start` sem herói dá 409.
- Herói excluído dá 404, some da lista e da busca, e continua com o nome visível na missão.
- Busca sem acento (`joao` encontra "João"). `%` e `_` na busca são tratados como texto. Paginação com muitos heróis no **mesmo `created_at`** não repete nem pula.
- O histórico registra o antigo e o novo de cada campo.
- O formato de erro e o status de cada caso da tabela da raiz.
- Seed rodado duas vezes não duplica. CSV reenviado não duplica. Duas importações simultâneas do mesmo arquivo não duplicam.

**Regras de teste**
- Testes de regra de negócio usam o **banco real**. Não use mock do banco para provar concorrência, UNIQUE ou collation.
- Testes de concorrência usam uma **barreira** (`Promise.all` com sincronização), para não passarem por sorte.
- Cada teste começa com as tabelas truncadas e usa factories de `apps/api/src/test-support`.

## O que NÃO fazer na API

- ❌ `UPDATE heroes` fora de `heroes/repository` (o histórico seria pulado).
- ❌ Travar a missão antes do herói.
- ❌ Usar `LIKE` com o texto do usuário sem escapar `%`, `_` e `\`.
- ❌ Usar `GET_LOCK`, ou um lock em memória, no lugar de `FOR UPDATE`.
- ❌ Processar o CSV dentro do pedido HTTP ou em memória sem job no banco.
