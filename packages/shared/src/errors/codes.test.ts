import { describe, expect, it } from "vitest";
import { errorStatusByCode, type ErrorCode } from "./codes.js";

describe("errorStatusByCode", () => {
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
