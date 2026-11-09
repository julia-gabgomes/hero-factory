import { describe, expect, it } from "vitest";
import {
  limits,
  errorStatusByCode,
  isFutureUtcPlus14,
  errorEnvelopeSchema,
  cursorPageSchema,
  idempotencyKeySchema,
  createHeroSchema,
  updateHeroSchema,
  createMissionSchema,
  missionStatusSchema,
} from "./index.js";

// Correção pós-revisão final · reexportação única — Dado o módulo
// packages/shared/src/index.ts, quando se importa dele (e não de um import
// profundo em schemas/, errors/, dates/ etc.), então os schemas e funções
// criados nesta tarefa estão disponíveis como valores em runtime. Os tipos
// inferidos (ErrorCode, CreateHeroInput etc.) também devem ser reexportados
// por esse mesmo caminho, mas um teste de tipo para cada um seria
// desproporcional, por isso este teste cobre só os valores/schemas.
describe("packages/shared entry point", () => {
  it("reexporta limits", () => {
    expect(limits).toBeDefined();
  });

  it("reexporta errorStatusByCode", () => {
    expect(errorStatusByCode).toBeDefined();
  });

  it("reexporta isFutureUtcPlus14", () => {
    expect(typeof isFutureUtcPlus14).toBe("function");
  });

  it("reexporta errorEnvelopeSchema", () => {
    expect(errorEnvelopeSchema).toBeDefined();
    expect(typeof errorEnvelopeSchema.safeParse).toBe("function");
  });

  it("reexporta cursorPageSchema", () => {
    expect(typeof cursorPageSchema).toBe("function");
  });

  it("reexporta idempotencyKeySchema", () => {
    expect(idempotencyKeySchema).toBeDefined();
    expect(typeof idempotencyKeySchema.safeParse).toBe("function");
  });

  it("reexporta createHeroSchema", () => {
    expect(createHeroSchema).toBeDefined();
    expect(typeof createHeroSchema.safeParse).toBe("function");
  });

  it("reexporta updateHeroSchema", () => {
    expect(updateHeroSchema).toBeDefined();
    expect(typeof updateHeroSchema.safeParse).toBe("function");
  });

  it("reexporta createMissionSchema", () => {
    expect(createMissionSchema).toBeDefined();
    expect(typeof createMissionSchema.safeParse).toBe("function");
  });

  it("reexporta missionStatusSchema", () => {
    expect(missionStatusSchema).toBeDefined();
    expect(typeof missionStatusSchema.safeParse).toBe("function");
  });
});
