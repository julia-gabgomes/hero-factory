import { describe, expect, it } from "vitest";
import { isFutureUtcPlus14 } from "./not-future.js";

// Assinatura adotada para `now`: um `Date` do JS representando o instante
// atual em UTC (ex.: `new Date("2026-11-09T23:00:00Z")`). A função não lê
// `Date.now()` internamente, então os testes passam um relógio falso fixo
// via esse parâmetro.

describe("isFutureUtcPlus14", () => {
  // Etapa 03 · C1.a — Dado um relógio falso fixado em 2026-11-09T23:00:00Z
  // (que já é dia 10 de novembro no fuso UTC+14, o mais adiantado do mundo),
  // quando se chama isFutureUtcPlus14("2026-11-10", now), então o resultado
  // é false, porque a data de nascimento é igual ao "hoje" em UTC+14, não
  // posterior a ele.
  // Cobre também C4.a: se a implementação usasse `new Date("2026-11-10")`
  // cru (que o motor JS interpreta como 2026-11-10T00:00:00Z) comparado
  // ingenuamente com o `now` em UTC, o resultado inverteria incorretamente
  // dependendo de como a comparação fosse feita, então um erro de fuso
  // nesse ponto faria este teste falhar.
  it("aceita uma data de nascimento igual a hoje em UTC+14", () => {
    const now = new Date("2026-11-09T23:00:00Z");

    expect(isFutureUtcPlus14("2026-11-10", now)).toBe(false);
  });

  // Etapa 03 · C2.a — Dado o mesmo relógio falso fixado em
  // 2026-11-09T23:00:00Z (dia 10 de novembro em UTC+14), quando se chama
  // isFutureUtcPlus14("2026-11-11", now), então o resultado é true, porque
  // a data de nascimento é um dia posterior ao "hoje" em UTC+14 em qualquer
  // lugar do mundo.
  it("rejeita uma data de nascimento um dia depois de hoje em UTC+14", () => {
    const now = new Date("2026-11-09T23:00:00Z");

    expect(isFutureUtcPlus14("2026-11-11", now)).toBe(true);
  });

  // Etapa 03 · C3.a — Dado um relógio falso fixado em 2026-11-10T09:00:00Z,
  // quando se desloca para UTC+14 dá 2026-11-10T23:00 (ainda dia 10 lá, o
  // fuso mais adiantado do mundo), e quando se desloca para UTC-12 dá
  // 2026-11-09T21:00 (já dia 9 lá). Quando se chama
  // isFutureUtcPlus14("2026-11-10", now), então o resultado é false, porque
  // em algum lugar do mundo (UTC+14) ainda é "hoje" para essa data, e a
  // regra nunca pode recusar uma data que ainda é hoje em algum fuso.
  // Cobre também C4.a: qualquer confusão de fuso ao converter "2026-11-10"
  // (por exemplo, usando `new Date("2026-11-10")`, que o JS trata como
  // UTC meia-noite, misturado com o `now` tratado como horário local do
  // processo) produziria um resultado diferente de false neste cenário de
  // borda, fazendo este teste falhar.
  it("aceita uma data que já é ontem em UTC-12 mas ainda é hoje em UTC+14", () => {
    const now = new Date("2026-11-10T09:00:00Z");

    expect(isFutureUtcPlus14("2026-11-10", now)).toBe(false);
  });
});
