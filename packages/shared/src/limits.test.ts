import { describe, expect, it } from "vitest";
import { limits } from "./limits.js";

describe("limits", () => {
  // Etapa 01 · C1.a — Dado o módulo limits.ts, quando se lê o valor exportado
  // para "name", então o valor é 120.
  it("exporta 120 como limite de name", () => {
    expect(limits.name).toBe(120);
  });

  // Etapa 01 · C1.b — Dado o módulo limits.ts, quando se lê o valor exportado
  // para nickname, universe, main_power, avatar_url e mission.title, então
  // os valores são, respectivamente, 60, 60, 80, 2048 e 120.
  it("exporta os limites de nickname, universe, main_power, avatar_url e mission.title", () => {
    expect(limits.nickname).toBe(60);
    expect(limits.universe).toBe(60);
    expect(limits.main_power).toBe(80);
    expect(limits.avatar_url).toBe(2048);
    expect(limits.mission.title).toBe(120);
  });
});
