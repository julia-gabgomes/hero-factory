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
