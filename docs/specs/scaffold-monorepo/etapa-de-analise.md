# Scaffold do monorepo

**Tipo:** funcionalidade · **Status:** em andamento · **Atualizada em:** 2026-11-09

## Problema

O repositório só tem os arquivos de contexto (`CLAUDE.md`, `docs/decisions.md`): não há workspace, não há `package.json`, não há como instalar dependências, lintar, checar tipos ou subir os serviços via Docker. Isso bloqueia o início de qualquer feature (heróis, missões) e a avaliação do projeto, que segue o README ao pé da letra num clone novo.

## Solução

Criar o esqueleto do monorepo definido no `CLAUDE.md`: workspace pnpm, os três pacotes (`packages/shared`, `apps/api`, `apps/web`) com `package.json`/`tsconfig.json` mínimos, `docker-compose.yml` com todos os serviços da topologia (mesmo os que ainda são placeholders), `nginx.conf` servindo a SPA e fazendo round-robin de `/api`, e lint/format na raiz. Nada de regra de negócio, rota real ou schema de banco — só estrutura que builda e liga.

**Motivo da escolha:** é a única solução sensata — a estrutura, as versões e a topologia já estão decididas no `CLAUDE.md`; esta etapa só materializa essas decisões em arquivos.

## Escopo

**Inclui:**

- `pnpm-workspace.yaml`, `package.json` raiz com `packageManager` fixado via corepack, `.nvmrc` com Node 24.
- `packages/shared`, `apps/api`, `apps/web`: `package.json` e `tsconfig.json` esqueleto (sem código de negócio; `apps/api` e `apps/web` podem ter um arquivo de entrada mínimo só para existir algo para buildar/lintar).
- `tsconfig.base.json` (ou equivalente) na raiz, estendido pelos pacotes, com `strict` e `noUncheckedIndexedAccess`.
- `docker-compose.yml` v1 com `mysql` (8.4, `utf8mb4_0900_ai_ci`, healthcheck) de verdade, e `migrate`/`api1`/`api2`/`worker`/`nginx` como placeholders (podem não ligar de ponta a ponta ainda, mas precisam estar declarados com a topologia e as dependências corretas de subida).
- `.env.example` com as variáveis já previstas no `CLAUDE.md` (ex.: credenciais do MySQL, `SEED_ON_START`).
- `nginx/nginx.conf` v1: proxy round-robin de `/api` para `api1`/`api2`, stub de SPA estática em `/`.
- ESLint 9 (flat config) + typescript-eslint em modo type-aware + Prettier 3 configurados na raiz, cobrindo os três pacotes.

**Não inclui:**

- Qualquer rota, schema de banco, migration ou regra de negócio (é a próxima fase do fluxo, feature por feature).
- Testes automatizados de regra de negócio (não há regra ainda).
- Scripts completos de `db:generate`/`db:migrate`/`db:seed` funcionais (eles podem existir como placeholders no `package.json`, mas não precisam ter lógica).
- Subida real e funcional do `docker compose up` de ponta a ponta com todos os serviços respondendo (os serviços de app são placeholders nesta etapa; só o `mysql` precisa realmente subir saudável).

## Critérios de aceite

- [ ] `pnpm install` na raiz termina sem erro, instalando os três pacotes do workspace.
- [ ] `pnpm lint` passa sem erros e sem warnings, mesmo sem código de negócio.
- [ ] `pnpm typecheck` passa sem erros em `packages/shared`, `apps/api` e `apps/web`.
- [ ] `node --version` dentro do diretório respeita o `.nvmrc` (Node 24) e o `packageManager` do `package.json` raiz aponta para pnpm 10 via corepack.
- [ ] `docker compose config` valida o `docker-compose.yml` sem erro, com a ordem de dependência `mysql → migrate → api1/api2/worker → nginx` declarada.
- [ ] `docker compose up -d mysql` sobe o MySQL 8.4 com collation `utf8mb4_0900_ai_ci` e o healthcheck fica saudável.
- [ ] `.env.example` existe e cobre todas as variáveis que o `docker-compose.yml` referencia.
- [ ] `nginx/nginx.conf` declara round-robin entre duas APIs upstream e um bloco servindo a SPA.

## Decisões

- Serviços de app (`migrate`, `api1`, `api2`, `worker`) entram como placeholders no compose (podem ser um `Dockerfile`/comando mínimo que só inicia e fica de pé) — permite validar a topologia e a ordem de subida antes de existir código real, evitando retrabalho na infraestrutura quando as features chegarem.
- Lint, Prettier e tsconfig ficam centralizados na raiz e são estendidos pelos pacotes — evita duplicar config e divergência de regras entre `api` e `web`, conforme o `CLAUDE.md` (seção 3.4).
- `apps/api` e `apps/web` recebem um arquivo de entrada mínimo (não vazio) só para que `lint`/`typecheck`/`build` tenham algo para processar — um workspace vazio não exercita a cadeia de ferramentas.

## Critérios de aceite da DoD geral (seção 4.5 do CLAUDE.md) aplicáveis a esta etapa

- [ ] Lint e typecheck verdes (testes de regra de negócio não se aplicam ainda).
- [ ] README (se já existir rascunho) e `CLAUDE.md` permanecem consistentes com os comandos criados.

## Detalhes

Nenhum arquivo de detalhe foi necessário: o escopo é inteiramente técnico e já está descrito com precisão no `CLAUDE.md` (seções 2, 3.1, 3.2 e 4.2), que serve como referência de implementação.

- [etapas/](etapas/) — etapas de desenvolvimento, uma por arquivo, em ordem; abra ao implementar.
