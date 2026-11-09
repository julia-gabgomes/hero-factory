import { describe, expect, it } from "vitest";
import { errorStatusByCode, type ErrorCode } from "./codes.js";

describe("errorStatusByCode", () => {
  // Etapa 02 · C1.a — Dado o módulo errors/codes.ts, quando se lê o status
  // associado a cada um dos 9 códigos da tabela do CLAUDE.md, então cada um
  // corresponde exatamente ao status esperado: BAD_REQUEST 400,
  // VALIDATION_ERROR 422, NOT_FOUND 404, VERSION_CONFLICT 409,
  // SCHEDULE_CONFLICT 409, INVALID_STATE 409, DUPLICATE_HERO 409,
  // IDEMPOTENCY_KEY_MISMATCH 422, INTERNAL_ERROR 500.
  it("associa cada um dos 9 códigos ao status HTTP da tabela do CLAUDE.md", () => {
    expect(errorStatusByCode.BAD_REQUEST).toBe(400);
    expect(errorStatusByCode.VALIDATION_ERROR).toBe(422);
    expect(errorStatusByCode.NOT_FOUND).toBe(404);
    expect(errorStatusByCode.VERSION_CONFLICT).toBe(409);
    expect(errorStatusByCode.SCHEDULE_CONFLICT).toBe(409);
    expect(errorStatusByCode.INVALID_STATE).toBe(409);
    expect(errorStatusByCode.DUPLICATE_HERO).toBe(409);
    expect(errorStatusByCode.IDEMPOTENCY_KEY_MISMATCH).toBe(422);
    expect(errorStatusByCode.INTERNAL_ERROR).toBe(500);
  });

  // Etapa 02 · C2.a — Dado o módulo errors/codes.ts, quando se conta as
  // chaves da tabela exportada, então o total é exatamente 9 (nem mais, nem
  // menos que os códigos listados no CLAUDE.md).
  it("não tem nenhuma chave além dos 9 códigos esperados", () => {
    const expectedKeys = [
      "BAD_REQUEST",
      "VALIDATION_ERROR",
      "NOT_FOUND",
      "VERSION_CONFLICT",
      "SCHEDULE_CONFLICT",
      "INVALID_STATE",
      "DUPLICATE_HERO",
      "IDEMPOTENCY_KEY_MISMATCH",
      "INTERNAL_ERROR",
    ].sort();

    expect(Object.keys(errorStatusByCode).sort()).toEqual(expectedKeys);
    expect(Object.keys(errorStatusByCode)).toHaveLength(9);
  });
});

// Etapa 02 · C3.a — Dado o tipo ErrorCode exportado pelo módulo, quando se
// chama uma função que só aceita esse tipo com cada um dos 9 códigos
// válidos, então o tsc aceita; quando se chama a mesma função com uma string
// arbitrária fora da lista, então o tsc rejeita (por isso a chamada abaixo
// só compila com o comentário @ts-expect-error, e sua ausência faria
// `pnpm --filter shared typecheck` falhar).
function expectErrorCode(code: ErrorCode): void {
  void code;
}

expectErrorCode("BAD_REQUEST");
expectErrorCode("VALIDATION_ERROR");
expectErrorCode("NOT_FOUND");
expectErrorCode("VERSION_CONFLICT");
expectErrorCode("SCHEDULE_CONFLICT");
expectErrorCode("INVALID_STATE");
expectErrorCode("DUPLICATE_HERO");
expectErrorCode("IDEMPOTENCY_KEY_MISMATCH");
expectErrorCode("INTERNAL_ERROR");

// @ts-expect-error - "NOT_A_REAL_ERROR_CODE" não pertence à união literal ErrorCode.
expectErrorCode("NOT_A_REAL_ERROR_CODE");
