import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  cursorPageSchema,
  errorEnvelopeSchema,
  idempotencyKeySchema,
  versionOnlyBodySchema,
} from "./common.js";

describe("errorEnvelopeSchema", () => {
  // Etapa 04 · C1.a — Dado um objeto com error.code = "NOT_FOUND",
  // error.message = "Herói não encontrado", error.fields = null e
  // error.details ausente, quando se valida contra o schema do envelope de
  // erro, então a validação passa.
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

  // Etapa 04 · C1.b — Dado um objeto com error.fields = { "name": "Campo
  // obrigatório" }, quando se valida contra o schema do envelope de erro,
  // então a validação passa.
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

  // Etapa 04 · C2.a — Dado um objeto com error.code = "CODIGO_INEXISTENTE",
  // quando se valida contra o schema do envelope de erro, então a validação
  // falha.
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

  // Etapa 04 · C3.a — Dado um objeto com data = [], next_cursor = null e
  // prev_cursor = null, quando se valida contra o schema de paginação
  // (instanciado para qualquer tipo de item), então a validação passa.
  it("aceita uma página vazia com cursores null", () => {
    const result = heroPageSchema.safeParse({
      data: [],
      next_cursor: null,
      prev_cursor: null,
    });

    expect(result.success).toBe(true);
  });

  // Etapa 04 · C3.b — Dado um objeto com data contendo itens e next_cursor
  // como uma string opaca, quando se valida, então a validação passa.
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
  // Etapa 04 · C4.a — Dado um valor no formato UUID padrão (8-4-4-4-12,
  // como um UUIDv7), quando se valida contra o schema do header
  // Idempotency-Key, então a validação passa. Nota: o valor do cenário no
  // arquivo da etapa ("0199-0000-0000-7000-000000000000") tem só 28 dígitos
  // hexadecimais (grupos 4-4-4-4-12) em vez dos 32 de um UUID padrão
  // (8-4-4-4-12), então foi substituído aqui por um UUIDv7 válido que
  // preserva a intenção do cenário — ver relato ao chamador.
  it("aceita um valor no formato UUID", () => {
    const result = idempotencyKeySchema.safeParse(
      "01990000-0000-7000-8000-000000000000",
    );

    expect(result.success).toBe(true);
  });

  // Etapa 04 · C4.b — Dado o valor "abc123" (não é UUID), quando se valida
  // contra o schema do header Idempotency-Key, então a validação falha.
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
