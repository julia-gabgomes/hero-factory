# 03 — Criar a validação de data de nascimento não futura

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** nenhuma

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
`packages/shared` passa a ter, em `dates/not-future.ts`, a função pura `isFutureUtcPlus14(dateOfBirth, now)`, que diz se uma data de nascimento (string `"YYYY-MM-DD"`) é posterior ao "hoje" no fuso mais adiantado do mundo (UTC+14) — a regra que decide se uma data de nascimento pode ser aceita. A função recebe o "agora" como parâmetro, para poder ser testada com um relógio falso sem mockar módulos globais, e não usa `new Date("YYYY-MM-DD")` em nenhum ponto.

## Critérios de aceite
- [x] C1 — Uma data de nascimento igual ao dia de hoje em UTC+14 é aceita (não é considerada futura).
- [x] C2 — Uma data de nascimento um dia depois de hoje em UTC+14 é rejeitada (é considerada futura).
- [x] C3 — Uma data de nascimento que já é "ontem" em UTC-12 mas ainda é "hoje" em UTC+14 é aceita.
- [x] C4 — A função nunca constrói um `Date` a partir da string `"YYYY-MM-DD"` sem especificar explicitamente o fuso (não usa `new Date("YYYY-MM-DD")` cru, que o motor JS interpreta como UTC meia-noite e pode divergir do horário local do processo).

## Cenários de teste
- **C1.a** — Dado um relógio falso fixado em `2026-11-09T23:00:00Z` (ainda dia 10 em UTC+14), quando se chama `isFutureUtcPlus14("2026-11-10", now)`, então o resultado é `false` (não é futura).
- **C2.a** — Dado o mesmo relógio falso (`2026-11-09T23:00:00Z`, dia 10 em UTC+14), quando se chama `isFutureUtcPlus14("2026-11-11", now)`, então o resultado é `true` (é futura).
- **C3.a** — Dado um relógio falso fixado em `2026-11-10T09:00:00Z` (ainda dia 10 em UTC+14 — 23h local — mas já dia 9 em UTC-12 — 21h do dia anterior), quando se chama `isFutureUtcPlus14("2026-11-10", now)`, então o resultado é `false` (não é futura, porque em algum lugar do mundo ainda é hoje).
- **C4.a** — Dado o código-fonte de `dates/not-future.ts`, quando se inspeciona a implementação, então não há nenhuma chamada a `new Date` recebendo diretamente uma string `"YYYY-MM-DD"` sem hora/fuso explícitos (verificado por revisão do código no teste, por exemplo garantindo que a função opera só com os componentes ano/mês/dia extraídos da string e do `now` recebido).

## Registro da implementação
**Testes**
- `packages/shared/src/dates/not-future.test.ts` — cenários C1.a, C2.a, C3.a, C4.a (C4.a coberto indiretamente pelos casos de borda de C1.a e C3.a, conforme comentário no próprio arquivo de teste)

**O que foi alterado**
- `packages/shared` passou a exportar a função `isFutureUtcPlus14(dateOfBirth, now)`, que compara uma data de nascimento `"YYYY-MM-DD"` com o "hoje" no fuso UTC+14, extraindo ano/mês/dia manualmente dos dois lados (sem usar `new Date` sobre a string da data de nascimento), para servir de base à validação de "não pode ser no futuro" usada pelo schema de herói.

**Correção pós-revisão:** o `now` do cenário C3.a estava matematicamente errado (`"2026-11-10T11:00:00Z"` já é 11 de novembro em UTC+14, não 10 como o comentário afirmava) e não testava a fronteira que o critério C3 pede. Trocado para `"2026-11-10T09:00:00Z"` (23h do dia 10 em UTC+14, 21h do dia 9 em UTC-12), verificado pela revisão. Nenhum código de produção foi alterado, só o dado do teste e o texto do cenário.
