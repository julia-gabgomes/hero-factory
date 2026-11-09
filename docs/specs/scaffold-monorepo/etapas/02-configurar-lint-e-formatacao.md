# 02 — Configurar lint e formatação na raiz

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** 01 (precisa dos pacotes existirem para ter algo a lintar)

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
O projeto passa a ter uma configuração única de lint e formatação na raiz, cobrindo os três pacotes do workspace, pronta para travar o padrão de código (sem `any`, sem promise solta, nomes por convenção) desde a primeira linha de código de negócio.

## Critérios de aceite
- [x] C1 — `pnpm lint` na raiz roda ESLint 9 em modo flat config sobre os três pacotes e termina sem erros nem warnings.
- [x] C2 — O lint usa typescript-eslint em modo type-aware (regras que dependem do `tsconfig`, como proibir `any` e floating promises, estão ativas).
- [x] C3 — `pnpm format` (Prettier 3) formata os arquivos dos três pacotes sem conflitar com as regras do ESLint.

## Cenários de teste
- **C1.a** — Dado o workspace com os três pacotes esqueleto, quando se roda `pnpm lint` na raiz, então o comando termina com código de saída 0 e sem nenhuma mensagem de warning ou erro.
- **C2.a** — Dado um arquivo de teste temporário com `const x: any = 1;` dentro de `apps/api`, quando se roda `pnpm lint`, então o lint reporta erro na regra que proíbe `any` (o arquivo de teste é removido depois da verificação, não faz parte do código final).
- **C2.b** — Dado um arquivo de teste temporário com uma Promise não tratada (`floating promise`) dentro de `apps/api`, quando se roda `pnpm lint`, então o lint reporta erro na regra `no-floating-promises` (o arquivo de teste é removido depois).
- **C3.a** — Dado os arquivos esqueleto formatados fora do padrão (ex.: aspas ou indentação diferentes), quando se roda `pnpm format`, então os arquivos passam a seguir o estilo do Prettier e `pnpm lint` continua passando sem erro depois da formatação.

## Fora desta etapa
- Regras específicas de domínio (ex.: `@tanstack/eslint-plugin-query`, `jsx-a11y`) que dependem de código real de `apps/web` usando essas bibliotecas — entram quando a feature que as usa for implementada, desde que não quebrem o `pnpm lint` vazio desta etapa.

## Registro da implementação
**Testes**
- `scripts/test-lint-and-format.sh` — cenários C1.a, C2.a, C2.b, C3.a

**O que foi alterado**
- Quem desenvolve passa a rodar `pnpm lint` e `pnpm format` na raiz e eles cobrem os três pacotes do workspace (`packages/shared`, `apps/api`, `apps/web`) com um único `eslint.config.js` (flat config) e um único `.prettierrc.json`.
- O lint usa `typescript-eslint` em modo type-aware (`projectService`, ligado ao `tsconfig.json` de cada pacote), com `@typescript-eslint/no-explicit-any` e `@typescript-eslint/no-floating-promises` como erro.
- `eslint-config-prettier` desliga as regras de estilo do ESLint que conflitariam com o Prettier.

**Desvios do planejado**
- O arquivo da etapa não detalhava o escopo do `pnpm format`; optei por excluir arquivos Markdown (`**/*.md`) do Prettier via `.prettierignore`, porque sem essa exclusão o `pnpm format` reformatava `CLAUDE.md`, `README.md` e `docs/decisions.md` como efeito colateral (quebras de linha em tabelas), mudando arquivos que não pertencem a esta etapa. O critério C3 fala em "formata os arquivos dos três pacotes", que o escopo atual já cobre.
- Adicionei `"type": "module"` ao `package.json` raiz: sem isso o Node emitia um warning (`MODULE_TYPELESS_PACKAGE_JSON`) ao carregar `eslint.config.js`, o que fazia o C1.a falhar (o teste considera qualquer "warning" na saída do `pnpm lint` como falha).

**Correção de revisão**
- Bloqueante: o bloco type-aware do `eslint.config.js` só cobria `**/*.ts`/`**/*.mts`/`**/*.cts`, sem `**/*.tsx`/`**/*.jsx` — um componente futuro de `apps/web` com `any` ou floating promise passaria sem erro. Corrigido incluindo `**/*.tsx` e `**/*.jsx` no mesmo bloco. Verificado na revisão de verificação: resolvido, sem bloqueante novo.

**Sugestões da revisão**
- `.prettierignore` — a exclusão de `**/*.md` também ignora `docs/specs/**/*.md` (arquivos de etapa), não só a documentação citada na justificativa; considerar restringir se algum dia quiser formatar specs via Prettier (não bloqueia nada hoje).
