# CLAUDE.md: Hero Factory

Guia de trabalho para pessoas e agentes de IA que desenvolvem este repositório. **Leia antes de escrever código.** Toda decisão registrada aqui foi tomada de propósito. Para mudar uma delas, atualize o CLAUDE.md correspondente primeiro e explique o motivo.

## Mapa dos guias

Cada regra fica em **um lugar só**. Os outros arquivos apenas apontam para ela.

| Arquivo | Quando é lido | Conteúdo |
|---|---|---|
| `CLAUDE.md` (este) | Sempre | Contexto, stack, topologia, pastas, contratos da API, estilo, comandos, fluxo, Definition of Done |
| [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) | Ao mexer em `apps/api` | Camadas, SQL, transações e locks, idempotência, versão, escalação, missão, histórico, avatar, CSV, desempenho, testes da API |
| [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md) | Ao mexer em `apps/web` | Visual da referência, estados de tela, TanStack Query, formulários, merge de edições, URL, testes da tela |
| [`docs/decisions.md`](docs/decisions.md) | **Não é carregado sozinho.** Leia antes de propor mudar uma decisão, ao escrever o README final ou ao preparar a entrevista | Decisões, alternativas descartadas e motivos |

Ao mexer em `packages/shared`, leia também a seção [Contratos da API](#33-contratos-da-api), porque o shared é a implementação deles.

---

## 1. Contexto do projeto e objetivos

### O que é

Sistema de **heróis e missões**, feito como desafio técnico fullstack. O objetivo central é ser um sistema que **continua certo com muita gente usando ao mesmo tempo**: a API roda em **duas instâncias** atrás de um único endereço, e qualquer pedido pode cair em qualquer uma delas.

### Como será avaliado (guie todas as decisões por isto)

1. O README será seguido **ao pé da letra**: os comandos precisam funcionar num clone novo.
2. A tela será usada como uma pessoa usaria.
3. A API será chamada **diretamente**, sem a tela, para tentar burlar as regras. **Toda regra precisa valer na API**, não só na tela.
4. O código será lido.
5. Haverá uma conversa sobre a entrega: cada decisão precisa ter justificativa (ver `docs/decisions.md`).

Prazo: **3 dias corridos**.

### Regras de negócio (resumo)

**Herói**
- Campos `name`, `nickname`, `universe`, `main_power` e `date_of_birth` são obrigatórios. `avatar_url` é opcional, com imagem padrão quando falta ou não carrega.
- Texto só com espaços conta como vazio. `date_of_birth` é um **dia sem hora**, igual em qualquer fuso, e não pode estar no futuro.
- `id`, `created_at` e `updated_at` são definidos **só pelo servidor**. Enviar esses campos no pedido não muda nada.
- **Inativo:** continua na lista, aparece com o card cinza e não pode ser escalado.
- **Excluído:** some da lista e da busca, **não volta**, e as missões continuam mostrando o nome dele.
- **Lista:** mais novos primeiro, 10 por página, 5 por linha no computador.
- **Busca:** por nome ou nome de guerra, em qualquer parte do texto, sem diferenciar maiúsculas nem acentos (`joao` encontra "João").
- **Paginação:** nenhum herói se repete nem some entre páginas, mesmo com vários criados no mesmo segundo.
- **Volume:** o seed cria **100 mil** heróis e é idempotente. A primeira página e a busca respondem em **menos de 0,3 s**, com a medição documentada.
- **Criar duas vezes** (clique duplo, ou a rede cai depois de a API criar) resulta em **um herói só**.
- **Edição simultânea:** quem salva por último recebe erro, junta as edições sem perder o que digitou, e a mudança da outra pessoa não se perde.
- **Histórico:** cada mudança (quando, valor antigo, valor novo) e as missões de que o herói participou com o resultado de cada uma. Paginado e com filtros.

**Missão**
- Situações: agendada → em andamento (exige pelo menos 1 herói) → sucesso ou fracasso. Pode ser cancelada antes de encerrar.
- Só se escalam ou tiram heróis enquanto a missão está **agendada**.
- **Choque de horário:** um herói não pode estar em duas missões que se sobrepõem. Os intervalos são semiabertos (terminar às 12h e começar às 12h **não** é choque). Missões encerradas ou canceladas não contam.
- **Escalação simultânea** em instâncias diferentes: **só uma vence**, e a outra recebe um erro que explica o choque.

**Importação de CSV (opcional):** até 20k linhas, em segundo plano, com progresso, resumo e motivo de cada linha recusada. Reenviar não duplica, e várias importações podem rodar ao mesmo tempo.

**Erros e telas:** formato de erro único, status HTTP coerente e mensagens claras indicando o campo. A tela segue a referência visual, sempre mostra os estados de espera, sucesso, erro e vazio, e funciona de 320 px a 1920 px, inclusive com nomes longos.

### Fora do escopo

Login, permissões e publicação na internet.

### Ordem de prioridade (obrigatória)

1. **Tudo o que é obrigatório, completo e com testes.**
2. Upload do avatar (opcional).
3. Importação de CSV (opcional).

Não comece um opcional enquanto o núcleo tiver regra sem teste ou com bug conhecido.

---

## 2. Stack tecnológico e versões

As versões abaixo são as **majors** escolhidas. As versões exatas ficam fixadas no `package.json` e no `pnpm-lock.yaml` no momento do scaffold. Na hora de adicionar um pacote, confira a última estável com `pnpm view <pacote> version`.

| Área | Tecnologia | Versão | Observação |
|---|---|---|---|
| Runtime | Node.js | 24 LTS | Fixado em `.nvmrc` e nas imagens Docker |
| Gerenciador | pnpm | 10 | Via corepack (`"packageManager"` no `package.json` raiz) |
| Linguagem | TypeScript | 5.x (última estável) | `strict`, `noUncheckedIndexedAccess` |
| Monorepo | pnpm workspaces | n/a | `apps/*`, `packages/*` |
| Banco | MySQL | 8.4 LTS | Em Docker, collation padrão `utf8mb4_0900_ai_ci` |
| Proxy e balanceador | Nginx | stable-alpine | Serve a SPA, faz round-robin de `/api` e serve `/uploads` |
| Orquestração | Docker Compose | v2 | Um comando sobe tudo |
| API | Fastify | 5 | Com `fastify-type-provider-zod` |
| Validação | Zod | 4 | Schemas compartilhados em `packages/shared` |
| Acesso ao banco | Drizzle ORM, drizzle-kit e mysql2 | última estável | Migrations SQL versionadas |
| Uploads | `@fastify/multipart` e sharp | última estável | Avatar e CSV |
| IDs | uuid (v7) | última estável | Ordenados no tempo |
| CSV | csv-parse | última estável | Leitura em stream |
| Web | React | 19 | SPA |
| Build da web | Vite | 7 | |
| Rotas da web | React Router | 7 | **Modo biblioteca** (sem SSR nem loaders do framework) |
| Estado do servidor | TanStack Query | 5 | |
| Formulários | React Hook Form e `@hookform/resolvers` | 7 | `zodResolver` com os schemas do `shared` |
| Estilo | Tailwind CSS | 4 | Tokens da referência no `@theme` |
| Componentes | shadcn/ui (Radix), Sonner, lucide-react | última estável | Componentes copiados para `components/ui` |
| Testes | Vitest, Testcontainers (MySQL), Testing Library, MSW | última estável | |
| E2E | Playwright | última estável | Contra o compose completo |
| Carga | k6 | imagem oficial | Perfil `bench` do compose |
| Lint e formatação | ESLint 9 (flat), typescript-eslint (type-aware), react-hooks, jsx-a11y, @tanstack/eslint-plugin-query, Prettier 3 | n/a | Pre-commit com lint-staged |

---

## 3. Arquitetura e convenções de código

### 3.1 Topologia

```
                       ┌──────────── volume "uploads" ────────────┐
                       │                                           │
Navegador ──▶ nginx:80 ├─ /            → SPA estática (apps/web)   │
                       ├─ /uploads/*   → arquivos do volume ◀──────┤
                       └─ /api/*       → round-robin ─┬─▶ api1 ──┐ │
                                                      └─▶ api2 ──┤ │
                                                    worker (CSV)─┤ │
                                                                 ▼
                                                              MySQL
```

Ordem de subida no `docker compose up --build`:

```
mysql (healthcheck)
 └─ migrate  (one-shot: migrations + seed de 100k idempotente se SEED_ON_START=true)
     ├─ api1
     ├─ api2
     └─ worker
         └─ nginx :80
```

**Regras de ouro da topologia**
- **Nenhum estado na memória da API.** Locks, idempotência, progresso de importação e qualquer coisa que outra instância precise ver ficam **no MySQL**. Os arquivos ficam no **volume compartilhado**.
- As migrations rodam **só** no serviço `migrate`, nunca na subida das APIs (as duas disputariam a mesma migration).
- A tela conhece um endereço só (`/api`, mesma origem). Não existe CORS.

### 3.2 Estrutura de pastas

Organização **por feature**, com camadas dentro de cada módulo. O detalhe interno de cada app está no CLAUDE.md dele.

```
hero-factory/
├─ apps/
│  ├─ api/          Fastify: modules/{heroes,missions,imports,uploads}, db/, http/, app.ts, server.ts, worker.ts
│  └─ web/          React: features/{heroes,missions,imports}, components/ui, lib/, routes/
├─ packages/
│  └─ shared/src/   schemas Zod · tipos inferidos · limites de campos · códigos de erro
├─ e2e/             Playwright
├─ bench/           scripts k6 (heroes.js)
├─ nginx/           nginx.conf
├─ docs/            performance.md · decisions.md
├─ docker-compose.yml
├─ .env.example
├─ pnpm-workspace.yaml
├─ CLAUDE.md
└─ README.md
```

`packages/shared` é a **fonte única** dos contratos: tela e API importam dele, e nenhum dos dois redeclara tipos ou regras de validação.

### 3.3 Contratos da API

Estes contratos valem para os dois lados. A API os impõe e a tela os consome.

**Envelope de erro (único para toda a API)**

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "O Hulk foi alterado depois que você abriu a edição.",
    "fields": null,
    "details": { "current": { "...": "herói atual" } }
  }
}
```

- `code`: identificador **estável**. É contrato, e a tela reage a ele.
- `message`: texto em **pt-BR**, claro para quem usa a tela.
- `fields`: mapa `campo → mensagem` quando o erro é de entrada, ou `null` nos demais casos.
- `details`: dados extras opcionais (versão atual, missão conflitante etc.).
- `Content-Type: application/json`.

| Situação | Status | `code` |
|---|---|---|
| JSON malformado ou header obrigatório ausente | 400 | `BAD_REQUEST` |
| Entrada inválida (Zod) | 422 | `VALIDATION_ERROR` |
| Recurso inexistente **ou excluído** | 404 | `NOT_FOUND` |
| Edição com versão antiga | 409 | `VERSION_CONFLICT` |
| Choque de horário na escalação | 409 | `SCHEDULE_CONFLICT` |
| Transição proibida, herói inativo, missão sem herói etc. | 409 | `INVALID_STATE` |
| Herói repetido (mesmo `name`, `nickname` e `date_of_birth`, inclusive excluídos) | 409 | `DUPLICATE_HERO` |
| `Idempotency-Key` reutilizada com outro corpo | 422 | `IDEMPOTENCY_KEY_MISMATCH` |
| Erro inesperado | 500 | `INTERNAL_ERROR` (sem stack nem SQL na resposta) |

**Campos e validação**
- O texto passa por `trim()` **antes** de validar e é **gravado já sem os espaços das pontas**. Texto só com espaços vira vazio, que dá erro de obrigatório.
- Os limites contam **code points** (caracteres), não bytes:

| Campo | Máx. |
|---|---|
| `name` | 120 |
| `nickname` | 60 |
| `universe` | 60 |
| `main_power` | 80 |
| `avatar_url` | 2048, só `http`/`https` (ou URL de `/uploads/`) |
| `mission.title` | 120 |

- Campos controlados pelo servidor (`id`, `created_at`, `updated_at`, `deleted_at`, `version` na criação, `status` na criação de missão) são **ignorados** na entrada.

**Formatos**
- **IDs:** UUIDv7, gerados pela API.
- **`date_of_birth`:** string `"YYYY-MM-DD"`, **ponta a ponta**, sem hora e sem fuso.
- **Timestamps:** ISO 8601 em UTC, com `Z`.
- **"Não pode ser no futuro":** a tela valida contra o hoje local. A API recusa só uma data **posterior ao hoje em UTC+14** (o fuso mais adiantado), para nunca recusar uma data que já é "hoje" em algum lugar do mundo.
- **JSON da API em `snake_case`**, como no README do desafio.

**Listas**
- Paginação por cursor opaco: `GET /heroes?limit=10&cursor=...&q=...` → `{ "data": [...], "next_cursor": "...", "prev_cursor": "..." }`. A mesma forma vale para histórico, missões e erros de importação.

**Cabeçalhos**
- `Idempotency-Key` (UUID): **obrigatório** em todo POST de criação (`/heroes`, `/missions`, `/imports`). Na repetição, a API devolve a mesma resposta com `Idempotent-Replayed: true`.
- `version` no corpo do `PATCH /heroes/:id`. Versão antiga resulta em 409 `VERSION_CONFLICT` com `details.current`.
- `Server-Timing` em toda resposta.

### 3.4 Estilo de código e idioma

- **Inglês:** identificadores, arquivos, rotas, tabelas, colunas, códigos de erro e comentários.
- **pt-BR:** textos da tela, `message` dos erros, README e os CLAUDE.md.
- Sem comentários.
- TypeScript `strict`. Sem `any` (use `unknown` e faça narrowing). Sem `@ts-ignore` sem justificativa.
- **Nenhuma promise solta** (`no-floating-promises`). Isso é crítico com transações.
- O ESLint e o Prettier precisam passar **sem warnings**.
- Nomes: `camelCase` para variáveis e funções, `PascalCase` para componentes e tipos, `kebab-case` para arquivos (exceto componentes React, que usam `PascalCase.tsx`), `snake_case` no banco e no JSON da API.

### 3.5 Glossário (pt-BR → código)

| Domínio | Código |
|---|---|
| Herói | `hero` |
| Nome completo | `name` |
| Nome de guerra | `nickname` |
| Habilidade / poder principal | `main_power` |
| Ativo / inativo | `is_active` |
| Excluído | `deleted_at` |
| Missão | `mission` |
| Escalar / tirar herói | `assign` / `unassign` (`mission_heroes`) |
| Agendada · Em andamento · Sucesso · Fracasso · Cancelada | `scheduled` · `in_progress` · `succeeded` · `failed` · `cancelled` |
| Iniciar · Encerrar · Cancelar | `start` · `finish` · `cancel` |
| Histórico | `hero_changes` |
| Importação | `import_job` |

---

## 4. Comandos de desenvolvimento e fluxo de trabalho

### 4.1 Pré-requisitos

- Para **rodar** o projeto: Docker com Compose v2.
- Para **desenvolver**: Node 24 (`nvm use`) e `corepack enable`, que instala o pnpm da versão fixada.

### 4.2 Comandos

| Objetivo | Comando |
|---|---|
| Subir tudo (banco vazio, o padrão) | `docker compose up --build`, depois abrir http://localhost |
| Subir com o seed de 100k | `SEED_ON_START=true docker compose up --build` |
| Derrubar e apagar os dados | `docker compose down -v` |
| Instalar dependências | `pnpm install` |
| Dev local (hot reload) | `docker compose up -d mysql` e depois `pnpm dev` (API com `tsx watch`, web com Vite e proxy de `/api`) |
| Lint | `pnpm lint` |
| Checagem de tipos | `pnpm typecheck` |
| Formatar | `pnpm format` |
| Testes (unitários e de integração, exige Docker) | `pnpm test` |
| Testes de um pacote | `pnpm --filter api test` / `pnpm --filter web test` |
| E2E (sobe o compose) | `pnpm test:e2e` |
| Gerar migration a partir do schema | `pnpm db:generate` |
| Aplicar migrations | `pnpm db:migrate` |
| Seed (idempotente) | `pnpm db:seed` |
| Resetar o banco (migrations e seed) | `pnpm db:reset` |
| Benchmark de 0,3 s | `docker compose --profile bench run --rm k6` |

Mantenha esta tabela, o `package.json`, o `docker-compose.yml` e o README **sempre consistentes**. Ao criar ou renomear um script, atualize os quatro.

### 4.3 Testes: visão geral

| Camada | Ferramenta | Detalhe em |
|---|---|---|
| Unitário | Vitest | CLAUDE.md de cada app |
| Integração da API (MySQL real) | Vitest, `app.inject()` e Testcontainers | `apps/api/CLAUDE.md` (lista obrigatória por regra) |
| Componentes | Vitest, Testing Library e MSW | `apps/web/CLAUDE.md` |
| E2E | Playwright no compose completo | Criar e ver na lista. Editar e ver no histórico. Inativar e ver o card cinza. Escalar e ver o choque. Viewport de 320 px |
| Carga | k6 | p95 abaixo de 300 ms com 100k (`apps/api/CLAUDE.md`) |

**Toda regra do README do desafio precisa de pelo menos um teste que a proteja.**

### 4.4 Fluxo de trabalho

1. Leia a regra no README do desafio e a decisão correspondente nos CLAUDE.md.
2. Se o contrato mudou, altere o schema em `packages/shared` primeiro.
3. Escreva o teste que protege a regra (de preferência antes da implementação).
4. Implemente seguindo as camadas do app.
5. Mudou o banco? Rode `pnpm db:generate` e **revise o SQL gerado** (índices, collation, `DATETIME(3)`), ajustando se preciso.
6. Rode `pnpm lint && pnpm typecheck && pnpm test`.
7. Faça commit pequeno no padrão **Conventional Commits, em inglês**: `feat(heroes): add optimistic locking on update`.

### 4.5 Definition of Done

- [ ] Lint, typecheck e testes verdes.
- [ ] A regra está protegida por teste de integração (e de concorrência, quando se aplica).
- [ ] A tela mostra carregando, erro com tentar de novo, vazio e sucesso.
- [ ] Funciona em 320 px e em 1920 px, com nomes longos.
- [ ] A API devolve o envelope de erro correto e o status correto.
- [ ] README, CLAUDE.md e `docs/decisions.md` atualizados se algo mudou (comandos, decisões, limites).

---

## 5. O que NÃO fazer

- ❌ Guardar estado na memória da API (cache de locks, mapa de idempotência, progresso de importação).
- ❌ "Verificar e depois inserir" sem lock ou sem UNIQUE.
- ❌ `new Date("YYYY-MM-DD")` para datas sem hora.
- ❌ Rodar migrations na subida das APIs.
- ❌ Responder erro fora do envelope, ou devolver 500 para uma entrada inválida.
- ❌ Tratar erro de rede como lista vazia na tela.
- ❌ Redeclarar na tela ou na API um tipo ou uma validação que existe em `packages/shared`.
- ❌ Começar um opcional com o obrigatório incompleto.
