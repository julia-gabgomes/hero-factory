# CLAUDE.md: Tela (apps/web)

Regras do frontend. Complementa o [`CLAUDE.md` da raiz](../../CLAUDE.md), que define os contratos da API (envelope de erro, limites, formatos, cabeçalhos).

## Estrutura

```
apps/web/src/
├─ features/
│  ├─ heroes/      components/ (HeroCard, HeroFormDialog, HeroDetailsDialog, HeroHistory…) · api.ts · hooks/ · merge-edits.ts
│  ├─ missions/    components/ · api.ts · hooks/
│  └─ imports/     components/ · api.ts · hooks/
├─ components/ui/  shadcn + estados compartilhados (LoadingState, ErrorState, EmptyState)
├─ lib/            api-client.ts · query-keys.ts · dates.ts · use-typed-search.ts
├─ routes/         layout, /heroes, /missions
└─ main.tsx
```

- Cada feature tem seu `api.ts` com hooks do TanStack Query. Componentes não chamam `fetch` direto.
- `components/ui` guarda só componentes genéricos. O que é específico de herói fica em `features/heroes`.
- Os tipos e schemas vêm de `packages/shared` (`z.infer`). Não redeclare tipos da API.
- Rotas: React Router 7 em **modo biblioteca** (`createBrowserRouter`), com `/heroes` (inicial) e `/missions`.

## Visual (referência)

As telas de referência (lista, criação, detalhes e menu de ações) definem layout, cores, componentes e espaçamentos. **Siga-as fielmente.**

Tokens no `@theme` do Tailwind:

```css
--color-background: #F8F4F0;   /* off-white quente */
--color-primary: #0A2FA8;      /* azul royal: título, Criar, Salvar, página ativa */
--color-primary-soft: #E4EAF8; /* fundos suaves, página ativa, ⋮ aberto */
--color-danger: #D92D3A;       /* lixeira */
--color-border: #D9D9D9;
--radius-card: 1.5rem;
--radius-modal: 1.75rem;
--font-sans: "Segoe UI", system-ui, -apple-system, "Noto Sans", sans-serif;
```

**Padrões**
- **Título** "Heróis" centralizado, em azul primário.
- **Barra superior:** botão Criar em **pílula** sólida, campo de busca em pílula branca sem borda com ícone de lupa, e botão Buscar em pílula com contorno.
- **Cards:** brancos, `rounded-3xl`, com sombra suave, avatar **circular**, nome centralizado com `truncate` e `title`, e botão ⋮ no canto.
- **Grade:** `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`.
- **Modal:** título com X, divisórias no cabeçalho e no rodapé, corpo com rolagem (`max-h-[90dvh]`) e overlay **lavanda translúcido**, nunca preto.
  - Os botões do modal são **retangulares com raio pequeno**: Cancelar com contorno e Salvar sólido.
- **Formulário:** labels em negrito acima de inputs em pílula com borda fina. Nome completo e nome de guerra ocupam a largura toda, e a partir de "Data de nascimento" o formulário tem 2 colunas (1 coluna no celular).
- **Detalhes do herói:** avatar grande centralizado e pares de rótulo e valor em 2 colunas. As abas são **Dados · Alterações · Missões**.
- **Menu ⋮:** só ícones, como na referência (lixeira vermelha, lápis azul, *switch* de ativo), cada um com `aria-label` ("Excluir herói", "Editar herói", "Inativar herói") e tooltip.
  - O *switch* **abre a confirmação** em vez de alternar na hora.
  - Para herói inativo, o menu mostra só o *switch* (desligado) e a lixeira, sem o lápis.
- **Herói inativo:** card com `grayscale opacity-60`.
- **Paginação:** "‹ Página N ›" no canto inferior direito, no estilo dos quadradinhos da referência.
- **Missões:** cabeçalho estilo painel (título à esquerda, botão "Criar missão" à direita), diferente do título centralizado de Heróis — decisão registrada em `docs/decisions.md`. Chips de situação multi-seleção com marcador colorido por situação (sem contagem). Cards com badge (marcador colorido + rótulo) e "⋮" de ações rápidas (Iniciar, Encerrar com sucesso/fracasso, Cancelar — só para `scheduled`/`in_progress`), período com ícone de calendário, e um empilhado de avatares com iniciais coloridas dos heróis escalados (ou "Nenhum herói escalado").
- **Telas sem referência** (importação, histórico) seguem os mesmos tokens e componentes.
- Deve funcionar de **320 px a 1920 px**, com nomes longos.

## Estados de tela

- **Todo dado remoto tem os quatro estados:** carregando, erro (com "Tentar de novo"), vazio e sucesso.
- **API fora do ar nunca pode parecer busca sem resultado.** Use `isPending` e `isError` do TanStack Query separadamente. "Nenhum herói cadastrado" e "Nenhum resultado para *x*" também são mensagens diferentes.
- Use `LoadingState`, `ErrorState` (com `onRetry` ligado ao `refetch`) e `EmptyState` de `components/ui`.
- Os retornos de sucesso e de erro das mutações aparecem em toasts (Sonner).
- Inativar, ativar e excluir **sempre pedem confirmação** (`AlertDialog`), com a ação por extenso ("Inativar Hulk? Ele não poderá ser escalado em missões.").

## Dados (TanStack Query)

- As query keys vêm de uma **fábrica** em `lib/query-keys.ts`.
- Depois de qualquer mutação, use `invalidateQueries` (a lista se atualiza sem recarregar a página).
- `lib/api-client.ts` centraliza o `fetch`, o parse do envelope de erro (lança um `ApiError` com `code`, `message`, `fields` e `details`) e o envio do `Idempotency-Key`.
- A busca é disparada pelo botão Buscar e pelo Enter, e o `AbortSignal` cancela a busca anterior.
- Na importação, o progresso usa `refetchInterval` de cerca de 1 s enquanto o job não termina.

## Estado na URL

- A busca (`q`), o cursor, o filtro de situação e o modal aberto (`?hero=<id>`) ficam na URL.
- `useTypedSearch(schema)` (`lib/use-typed-search.ts`) lê e escreve esses parâmetros com parse em Zod.
- Atualizar a página e o botão voltar preservam o contexto (voltar fecha o modal).

## Formulários

- React Hook Form com `zodResolver` e **os schemas do `shared`**.
- Os erros de campo da API (`error.fields`) são aplicados com `setError` no campo correspondente.
- O botão Salvar fica desabilitado durante o envio. Isso ajuda, mas a garantia real é a idempotência da API.
- **Idempotency-Key:** gere com `crypto.randomUUID()` **quando o modal de criação abre**, reutilize em todas as tentativas de Salvar e gere outra só depois do sucesso ou ao fechar o modal.
- O PATCH envia `version` e **só os campos alterados** (`dirtyFields`).
- O seletor de data de nascimento recebe `max = hoje local`.

## Edição simultânea: merge de três vias

- Ao abrir a edição, guarde o snapshot **base** (o herói e a `version`).
- Num 409 `VERSION_CONFLICT`, chame `mergeEdits(base, mine, theirs)` (`features/heroes/merge-edits.ts`), uma função **pura e testada**, com `theirs = details.current`:
  - Campo que só a outra pessoa mudou recebe o valor dela.
  - Campo que só eu mudei mantém o que digitei.
  - Campo que os dois mudaram com valores diferentes fica **destacado** ("Outra pessoa mudou para X. Você digitou Y."), e a pessoa escolhe.
- Mostre um aviso ("O Hulk mudou desde que você abriu. Juntamos as alterações: revise e salve.") e passe o formulário para a nova `version`. **Nada do que foi digitado se perde.**

## Datas

- `date_of_birth` é string `YYYY-MM-DD`. Formate para `DD/MM/AAAA` **manipulando a string** (`lib/dates.ts`). **Proibido `new Date("YYYY-MM-DD")`**.
- Timestamps são exibidos com `Intl.DateTimeFormat` no fuso do navegador.
- O `datetime-local` da criação de missão é convertido para ISO em UTC antes de enviar.

## Avatar

- Sem `avatar_url`, ou quando a imagem falha (`onError`), mostre a imagem padrão.
- O upload (opcional) chama `POST /uploads/avatars` e coloca a URL devolvida no campo `avatar_url` do formulário.

## Testes da tela

**Ferramentas:** Vitest, Testing Library e MSW.

**Unitários:** `mergeEdits` (todos os casos da tabela acima), formatação de datas sem deslocamento de fuso, `useTypedSearch`.

**Componentes (obrigatórios):**
- Lista: estados carregando, erro com tentar de novo (com o MSW simulando API fora), vazio e com resultado.
- Menu conforme a situação: ativo mostra excluir, editar e switch ligado. Inativo mostra excluir e switch desligado.
- Confirmação antes de inativar, ativar e excluir.
- Erro de campo vindo da API aparece no campo certo.
- Fluxo do 409 com merge, preservando o que foi digitado.

**Regras:** encontre elementos por papel e nome acessível (`getByRole('menuitem', { name: 'Excluir herói' })`), não por classes.

## O que NÃO fazer na tela

- ❌ `fetch` direto em componente.
- ❌ Mostrar "nenhum resultado" quando a requisição falhou.
- ❌ Gerar um `Idempotency-Key` novo a cada clique em Salvar.
- ❌ Recarregar a página (ou o formulário) depois de um 409 e perder o que foi digitado.
- ❌ Fugir dos tokens e padrões da referência sem registrar o motivo.
