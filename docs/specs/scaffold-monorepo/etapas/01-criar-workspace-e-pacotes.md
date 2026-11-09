# 01 — Criar o workspace pnpm e os pacotes esqueleto

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** nenhuma

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
O monorepo passa a existir como workspace pnpm: `packages/shared`, `apps/api` e `apps/web` existem como pacotes TypeScript válidos, cada um com um ponto de entrada mínimo, instaláveis e checáveis em tipo, mesmo sem nenhuma lógica de negócio.

## Critérios de aceite
- [x] C1 — `pnpm install` na raiz termina sem erro e reconhece os três pacotes do workspace.
- [ ] C2 — `node --version` dentro do diretório do projeto respeita o Node fixado em `.nvmrc` (24). (verificação manual)
- [ ] C3 — `package.json` raiz declara `packageManager` apontando para pnpm 10 (via corepack). (verificação manual)
- [x] C4 — `pnpm typecheck` passa sem erro em `packages/shared`, `apps/api` e `apps/web`.
- [ ] C5 — Cada pacote tem `tsconfig.json` estendendo uma configuração base na raiz com `strict` e `noUncheckedIndexedAccess` habilitados. (verificação manual)

## Cenários de teste
- **C1.a** — Dado um clone novo do repositório, quando se roda `pnpm install` na raiz, então a instalação termina com código de saída 0 e cria `node_modules` nos três pacotes.
- **C2.a (verificação manual)** — Dado o Node gerenciado por `nvm`, quando se roda `nvm use` na raiz do projeto, então a versão ativada é a 24.x, conforme o `.nvmrc`.
- **C3.a (verificação manual)** — Dado o `package.json` raiz aberto, quando se olha o campo `packageManager`, então ele aponta para `pnpm@10.x.x`.
- **C4.a** — Dado o workspace instalado, quando se roda `pnpm typecheck` na raiz, então o comando termina com código de saída 0 para os três pacotes, sem nenhum erro de tipo.
- **C5.a (verificação manual)** — Dado o `tsconfig.json` de qualquer um dos três pacotes aberto, quando se olha o campo `extends`, então ele referencia a configuração base da raiz, e essa base tem `strict: true` e `noUncheckedIndexedAccess: true`.

## Valores provisórios
- Arquivo de entrada mínimo em `apps/api` e `apps/web` (ex.: uma função ou export vazio tipado) só para existir algo para o `tsc` processar — será substituído pelo código real nas próximas tarefas de implementação das features.

## Registro da implementação
**Testes**
- `scripts/test-workspace-install-and-typecheck.sh` — cenários C1.a, C4.a (não há suíte Vitest nesta etapa: o script roda `pnpm install`, confirma que `node_modules` existe na raiz e nos três pacotes, e depois roda `pnpm typecheck`, parando com código de saída diferente de 0 no primeiro passo que falhar).

**O que foi alterado**
- O repositório passou a ser um workspace pnpm: `pnpm-workspace.yaml` lista `apps/*` e `packages/*`.
- `package.json` raiz declara `packageManager: "pnpm@10.9.0"` (major 10, via corepack) e o script `typecheck`, que roda `pnpm -r run typecheck` em todos os pacotes do workspace.
- `.nvmrc` fixa o Node na major 24.
- `tsconfig.base.json` na raiz liga `strict` e `noUncheckedIndexedAccess`, entre outras opções base (módulos NodeNext, declarations, source maps).
- `packages/shared`, `apps/api` e `apps/web` existem como pacotes TypeScript (`@hero-factory/shared`, `@hero-factory/api`, `@hero-factory/web`), cada um com `tsconfig.json` estendendo a base da raiz, script `typecheck` (`tsc --noEmit`) e um ponto de entrada mínimo tipado (`src/index.ts` no shared, `src/server.ts` na api, `src/main.ts` na web) que apenas importa o shared e expõe uma função trivial, sem lógica de negócio.
- `apps/api` e `apps/web` dependem de `@hero-factory/shared` via `workspace:*`, confirmando a resolução de pacotes do workspace.

**Desvios do planejado**
- O arquivo de entrada da web foi criado como `src/main.ts` (não `src/main.tsx`), já que nesta etapa não há React/JSX configurado ainda — é só o esqueleto tipado pedido pelos "Valores provisórios". A convenção `main.tsx` da estrutura de pastas (`apps/web/CLAUDE.md`) será adotada quando a etapa que configura a tela React for implementada.

**Correção de revisão**
- Bloqueante: não havia `.gitignore` no repositório, com risco de `node_modules/` entrar no histórico do git. Corrigido criando `.gitignore` cobrindo `node_modules/`, `dist/`, `build/`, `.env` (exceto `.env.example`), logs, artefatos de editor e `coverage/`, sem ignorar `pnpm-lock.yaml`. Verificado na revisão de verificação: resolvido, sem bloqueante novo.

**Sugestões da revisão**
- `apps/api/package.json`, `apps/web/package.json` (campo `main`) — hoje apontam para o `.ts` fonte (`src/server.ts`/`src/main.ts`); revisar quando existir build (`dist`) para não publicar a fonte TS como entrypoint.
- `pnpm-lock.yaml` — garantir que seja comitado junto com o restante desta etapa (não deixá-lo de fora por engano no primeiro commit).
