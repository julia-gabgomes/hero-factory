import { describe, expect, it } from "vitest";
import { isFutureUtcPlus14 } from "./not-future.js";

describe("isFutureUtcPlus14", () => {
  it("aceita uma data de nascimento igual a hoje em UTC+14", () => {
    const now = new Date("2026-11-09T23:00:00Z");

    expect(isFutureUtcPlus14("2026-11-10", now)).toBe(false);
  });

  it("rejeita uma data de nascimento um dia depois de hoje em UTC+14", () => {
    const now = new Date("2026-11-09T23:00:00Z");

    expect(isFutureUtcPlus14("2026-11-11", now)).toBe(true);
  });

  it("aceita uma data que já é ontem em UTC-12 mas ainda é hoje em UTC+14", () => {
    const now = new Date("2026-11-10T09:00:00Z");

    expect(isFutureUtcPlus14("2026-11-10", now)).toBe(false);
  });
});
