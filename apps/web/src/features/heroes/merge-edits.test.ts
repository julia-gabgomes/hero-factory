import { describe, expect, it } from "vitest";
import { mergeEdits } from "./merge-edits.js";

interface HeroFields {
  nickname: string;
  universe: string;
  main_power: string;
}

const fields: Array<keyof HeroFields> = ["nickname", "universe", "main_power"];

function base(): HeroFields {
  return { nickname: "Super", universe: "DC", main_power: "Voo" };
}

describe("mergeEdits", () => {
  it("campo que só a outra pessoa mudou recebe o valor dela", () => {
    const mine = base();
    const theirs = { ...base(), universe: "Universo Alternativo" };

    const result = mergeEdits(base(), mine, theirs, fields);

    expect(result.merged.universe).toBe("Universo Alternativo");
    expect(result.conflicts).toEqual([]);
  });

  it("campo que só eu mudei mantém o que eu digitei", () => {
    const mine = { ...base(), nickname: "Super-Homem" };
    const theirs = base();

    const result = mergeEdits(base(), mine, theirs, fields);

    expect(result.merged.nickname).toBe("Super-Homem");
    expect(result.conflicts).toEqual([]);
  });

  it("campo que os dois mudaram para o mesmo valor não gera conflito", () => {
    const mine = { ...base(), main_power: "Super força" };
    const theirs = { ...base(), main_power: "Super força" };

    const result = mergeEdits(base(), mine, theirs, fields);

    expect(result.merged.main_power).toBe("Super força");
    expect(result.conflicts).toEqual([]);
  });

  it("campo que os dois mudaram para valores diferentes mantém o meu e marca conflito", () => {
    const mine = { ...base(), nickname: "Super-Homem" };
    const theirs = { ...base(), nickname: "Homem de Aço" };

    const result = mergeEdits(base(), mine, theirs, fields);

    expect(result.merged.nickname).toBe("Super-Homem");
    expect(result.conflicts).toEqual(["nickname"]);
  });

  it("não perde nenhuma edição minha, mesmo com múltiplos campos em conflito", () => {
    const mine = {
      nickname: "Super-Homem",
      universe: "DC Comics",
      main_power: "Voo",
    };
    const theirs = {
      nickname: "Homem de Aço",
      universe: "DC",
      main_power: "Visão de calor",
    };

    const result = mergeEdits(base(), mine, theirs, fields);

    // nickname: conflito (os dois mudaram diferente) -> mantém o meu
    // universe: só eu mudei -> mantém o meu
    // main_power: só a outra pessoa mudou -> pega o dela
    expect(result.merged).toEqual({
      nickname: "Super-Homem",
      universe: "DC Comics",
      main_power: "Visão de calor",
    });
    expect(result.conflicts).toEqual(["nickname"]);
  });

  it("nenhum dos dois mudou um campo: mantém o valor base", () => {
    const result = mergeEdits(base(), base(), base(), fields);

    expect(result.merged).toEqual(base());
    expect(result.conflicts).toEqual([]);
  });
});
