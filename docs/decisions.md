# Decisões e trade-offs

Registro das decisões de projeto, das alternativas descartadas e dos motivos. Use para o README final, para a entrevista e **antes de propor mudar qualquer decisão**. Se uma decisão mudar, atualize esta tabela e o CLAUDE.md correspondente.

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| Monorepo com web e API separadas | Next.js unificado | Erro global, hooks, testes de API e worker de CSV mais naturais. Escala só a API, como no diagrama |
| pnpm com Node 24 LTS | npm | Workspaces rígidos (sem dependência fantasma), mais rápido, versão fixada via corepack |
| Nginx | Apache, Caddy, Traefik, HAProxy | Serve a SPA e balanceia com configuração curta. Padrão de mercado na frente de Node |
| Seed na subida, controlado por `SEED_ON_START` | Seed como comando separado | Um comando entrega o volume pronto para avaliar os 0,3 s, e continua possível começar vazio |
| Fastify | NestJS, Express | Zod compartilhado nativo, erro global, `inject()`, menos boilerplate em 3 dias |
| Drizzle | Prisma, Kysely, SQL puro | `FOR UPDATE`, colunas geradas e SQL legível sem cair em consulta crua |
| Tailwind com shadcn/ui | Mantine, MUI | A referência tem visual próprio (pílulas, raios grandes, overlay lavanda), mais fácil de reproduzir com componentes editáveis |
| TanStack Query, React Hook Form, React Router 7 | SWR, TanStack Form, TanStack Router | Padrão de mercado, com estados de erro e vazio separados, schemas compartilhados e estado na URL |
| Envelope de erro próprio | RFC 9457 | Enxuto, com `code` estável. O identificador estável é decisão de projeto, não do formato |
| Cursor com "‹ Página N ›" | Offset com números | Só o cursor garante "nenhum repete nem some" com criações e exclusões simultâneas |
| `LIKE` com collation ai_ci | FULLTEXT ngram, Meilisearch | Simples e suficiente para 100k (medido). Caminho de evolução documentado |
| k6 no Docker, `EXPLAIN` e `Server-Timing` | autocannon, teste de tempo no Vitest | Mede passando pelo balanceador, com threshold objetivo e sem instalar nada |
| Tabela `idempotency_keys` na mesma transação | Coluna única no recurso | Atômica, genérica para todos os POSTs, repete a resposta e confere o corpo |
| Versão com merge de três vias na tela | Comparação lado a lado, merge no servidor | Cumpre "Bruno recebe erro" e não perde nada. Só pede decisão em conflito real |
| `FOR UPDATE` no herói | `GET_LOCK`, SERIALIZABLE, fatias de tempo | Correto entre instâncias, simples, sem deadlock com ordem fixa |
| Missão com transições manuais e horários imutáveis | Horários editáveis, situação pelo relógio | Segue a letra do README com a menor superfície de concorrência |
| `hero_changes` por campo | Triggers, snapshot por versão | Atômico, filtrável por campo, testável |
| UUIDv7 em `CHAR(36)` | UUIDv4, `BINARY(16)`, BIGINT | Ordenado no tempo (bom para o InnoDB e para o cursor) e legível |
| API valida "não futuro" em UTC+14 | Fuso enviado pelo cliente, UTC | O fuso do cliente não traz segurança. Nunca recusa uma data legítima |
| Limites calibrados por campo | `VARCHAR(255)` para tudo | O README pede para definir. Limites coerentes com o domínio |
| Repetido inclui excluídos | Só entre não excluídos | Reimportar não ressuscita herói excluído |
| Volume compartilhado com Nginx | MinIO, BLOB | Resolve as 2 instâncias sem serviço extra. `FileStorage` permite trocar por S3 |
| Fila no MySQL com worker dedicado | BullMQ e Redis, worker na API | Sem infra nova, a API não divide CPU com a importação, há retomada após queda |
| Menu só com ícones, com `aria-label` e tooltip | Ícone com texto | Fiel à referência e acessível |
| Testcontainers, MSW e Playwright | MySQL de teste no compose, sem E2E | Concorrência provada no banco real, suíte autocontida, ponta a ponta coberta |
| ESLint com typescript-eslint e Prettier | Biome | Regras com consciência de tipos (promises soltas), a11y e hooks |
| Código em inglês, tela e docs em pt-BR | Tudo em um idioma só | Coerente com o contrato do README e com quem avalia |
| Organização por feature | Por camada, Clean Architecture | Coesão do domínio sem cerimônia. As regras dependem de recursos do MySQL de qualquer forma |
| Heróis escalados embutidos no `GET /missions/:id` | Endpoint paginado `/missions/:id/heroes` | O número de heróis por missão é pequeno e `mission_heroes` não tem `created_at` para servir de cursor; não alteramos uma migration já commitada e testada só por isso |
| Reescalar o mesmo herói na mesma missão vira `SCHEDULE_CONFLICT` | Checagem extra de "já escalado" | A query de choque de horário não exclui a missão alvo, então o caso resolve sozinho, apontando a própria missão como conflito, sem código a mais |
| `cancel` com `UPDATE ... WHERE status IN (:origens)` | Duas rotas de cancelamento, uma por estado de origem | Mesma transição atômica do restante da máquina de estados (0 linhas afetadas → `INVALID_STATE`), só com mais de uma origem válida |
| `GET /heroes/:id/missions` separado de `/history` | Um único endpoint juntando `hero_changes` e missões | Paginação e filtros diferentes (campo/período vs. situação); reaproveita `missions/repository` no sentido inverso ao já autorizado pelo CLAUDE.md |
| `Server-Timing` via `AsyncLocalStorage` no `db/client.ts` | Medir tempo de banco em cada repository | Centraliza a instrumentação num único lugar (o pool mysql2), sem tocar nos repositories existentes nem arriscar esquecer um caminho de escrita |
| Limpeza de `idempotency_keys` com `setInterval` em cada instância | Serviço/cron dedicado | O `DELETE` é idempotente e seguro sob concorrência; não compensa a complexidade de outro processo só para isso |
| Uma imagem Docker para `migrate`/`api1`/`api2`, variando o `command` | Uma imagem por serviço | Mesmo código, mesmas dependências; só a etapa do boot muda (migrar+semear vs. servir) |
| Seed determinístico por índice, com grupos de busca propositais | Nomes aleatórios (`randomUUID()`) | É o que torna o `INSERT IGNORE` idempotente entre execuções, e os grupos ("Thor", "Zorblatt") alimentam o benchmark sem precisar de dados extras |
| Benchmark k6 com 5 VUs e `sleep(1)` por cenário | Laço sem pausa (`constant-vus` a toda velocidade) | Medido na prática: sem pausa, o cenário rápido gera dezenas de milhares de req/s e derruba conexões por saturar um único worker do Nginx — não é o que "p95 < 300 ms com uma carga constante" pede |
| `components/ui` escrito à mão sobre Radix UI | CLI `shadcn add` | Tailwind 4 é recente demais para confiar na geração automática; componentes próprios dão controle total e ficam testáveis igual ao resto |
| Tailwind 4 via `@tailwindcss/vite` + `@theme` no CSS | `tailwind.config.js` | É o padrão atual do Tailwind 4 para os tokens da referência (cor, raio, fonte), sem arquivo de config extra |
| Contratos de saída (`heroResponseSchema`, `missionResponseSchema`, schemas de query) adicionados ao `shared` | Tela redeclarando os tipos de resposta | O `shared` já tinha só os schemas de entrada; sem isso a tela violaria "não redeclare tipos da API" |
| Nginx builda a SPA (multi-stage) e serve `dist/` | Volume com os arquivos buildados à parte | Mesmo padrão da imagem da API: artefato de build dentro da própria imagem, sem passo manual extra no `docker compose up --build` |
| Merge de três vias mantém o meu valor em conflito, só destaca | Perguntar antes de salvar, bloqueando o envio | Cumpre "nada do que foi digitado se perde" sem um segundo diálogo; a pessoa revisa o campo destacado e decide se quer trocar pelo valor da outra pessoa |
| Ajustar estado durante a renderização (comparando a prop anterior) em vez de `useEffect` para idempotency key e reset do formulário | `useEffect` disparando no `open` | Padrão recomendado pelo React para "reagir a uma prop mudando"; evita o novo aviso de lint `react-hooks/set-state-in-effect` e o atraso de um efeito |
| Cursor e filtros do histórico do herói em estado local do componente, não na URL | Prefixar parâmetros na URL (`history_cursor`, `history_field`...) | A aba vive dentro de um modal, não é uma rota própria; é o mesmo padrão já usado pela aba Missões. Sem ganho real de deep link para um estado que só importa com o modal aberto |
| Cabeçalho da tela de Missões com título à esquerda e botão à direita, divergindo do título centralizado de Heróis | Manter o mesmo título centralizado em todas as telas | A referência visual pedida para Missões é um cabeçalho estilo painel; as duas telas não precisam ser idênticas, e a decisão fica registrada para não parecer inconsistência não intencional |
| Chips de situação de Missões sem contagem, e sem total de missões no cabeçalho | Calcular contagem real (total e por situação) na API, como foi feito no histórico do herói | A paginação é por cursor (sem `COUNT` hoje); como essa contagem é só estética aqui (ao contrário do histórico, onde a contagem orienta o filtro), não compensou estender a API só para mostrar um número |
| `assigned_heroes`/`assigned_heroes_total` embutidos no `GET /missions` (schema novo `missionListItemSchema`, à parte de `missionResponseSchema`) | Buscar os heróis de cada missão sob demanda no card (N chamadas) | Uma consulta só, agrupada em memória por `mission_id` (mesmo padrão do `field_totals` do histórico), evita N+1 na grade de cards; o schema novo não contamina `GET /heroes/:id/missions`, que não precisa dessa prévia |
| Menu "⋮" do card de missão dispara as ações direto, sem `ConfirmDialog` | Confirmar Iniciar/Encerrar/Cancelar como nas ações de herói | O `MissionDetailsDialog` já não confirma nenhuma dessas ações; confirmar só no atalho do card criaria dois comportamentos diferentes para a mesma ação, dependendo de onde ela foi disparada |
| Modal de detalhes da missão mantém `DialogHeader`/`DialogFooter` padrão (título com X, "Fechar" no rodapé) | Cabeçalho flutuante só com X, como na referência | Todo modal do projeto segue essa moldura, e o título acessível do diálogo vem do `DialogHeader`; usar só o badge de situação como título enfraqueceria o nome acessível do modal |
| Lista de candidatos para escalar herói aparece sempre (mesmo com a busca vazia) | Só mostrar a lista depois de digitar, como era antes | Fiel à referência, e a consulta já existia sem termo (heróis ativos em geral); só faltava não esconder o resultado |
| Cor e iniciais do avatar extraídas para `features/missions/hero-avatar.ts` | Duplicar a lógica entre o empilhado da listagem e as listas do modal de detalhes | Mesmo herói precisa da mesma cor em qualquer lugar que apareça; uma função só evita divergência |
