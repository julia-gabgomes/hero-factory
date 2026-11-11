import { describe, expect, it } from "vitest";
import { limits } from "./limits.js";

describe("limits", () => {
  it("exporta 120 como limite de name", () => {
    expect(limits.name).toBe(120);
  });

  it("exporta os limites de nickname, universe, main_power, avatar_url e mission.title", () => {
    expect(limits.nickname).toBe(60);
    expect(limits.universe).toBe(60);
    expect(limits.main_power).toBe(80);
    expect(limits.avatar_url).toBe(2048);
    expect(limits.mission.title).toBe(120);
  });
});
