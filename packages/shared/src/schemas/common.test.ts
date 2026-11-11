import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  cursorPageSchema,
  errorEnvelopeSchema,
  idempotencyKeySchema,
  versionOnlyBodySchema,
} from "./common.js";

describe("errorEnvelopeSchema", () => {
  it("aceita um envelope com code válido, message, fields null e details ausente", () => {
    const result = errorEnvelopeSchema.safeParse({
      error: {
        code: "NOT_FOUND",
        message: "Herói não encontrado",
        fields: null,
      },
    });

    expect(result.success).toBe(true);
  });

  it("aceita um envelope com fields preenchido por um mapa campo → mensagem", () => {
    const result = errorEnvelopeSchema.safeParse({
      error: {
        code: "VALIDATION_ERROR",
        message: "Dados inválidos",
        fields: { name: "Campo obrigatório" },
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejeita um error.code que não esteja na tabela de códigos", () => {
    const result = errorEnvelopeSchema.safeParse({
      error: {
        code: "CODIGO_INEXISTENTE",
        message: "Qualquer mensagem",
        fields: null,
      },
    });

    expect(result.success).toBe(false);
  });
});

describe("cursorPageSchema", () => {
  const heroItemSchema = z.object({ id: z.string() });
  const heroPageSchema = cursorPageSchema(heroItemSchema);

  it("aceita uma página vazia com cursores null", () => {
    const result = heroPageSchema.safeParse({
      data: [],
      next_cursor: null,
      prev_cursor: null,
    });

    expect(result.success).toBe(true);
  });

  it("aceita uma página com itens e next_cursor como string opaca", () => {
    const result = heroPageSchema.safeParse({
      data: [{ id: "0199-0000-0000-7000-000000000000" }],
      next_cursor: "opaque-cursor-value",
      prev_cursor: null,
    });

    expect(result.success).toBe(true);
  });

  it("é genérico: valida o formato de página para outro tipo de item (missão)", () => {
    const missionItemSchema = z.object({ title: z.string() });
    const missionPageSchema = cursorPageSchema(missionItemSchema);

    const result = missionPageSchema.safeParse({
      data: [{ title: "Salvar Gotham" }],
      next_cursor: null,
      prev_cursor: "opaque-prev-cursor",
    });

    expect(result.success).toBe(true);
  });
});

describe("idempotencyKeySchema", () => {
  it("aceita um valor no formato UUID", () => {
    const result = idempotencyKeySchema.safeParse(
      "01990000-0000-7000-8000-000000000000",
    );

    expect(result.success).toBe(true);
  });

  it("rejeita um valor que não seja UUID", () => {
    const result = idempotencyKeySchema.safeParse("abc123");

    expect(result.success).toBe(false);
  });
});

describe("versionOnlyBodySchema", () => {
  it("aceita um corpo só com version", () => {
    const result = versionOnlyBodySchema.safeParse({ version: 1 });

    expect(result.success).toBe(true);
  });

  it("rejeita um corpo sem version", () => {
    const result = versionOnlyBodySchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
