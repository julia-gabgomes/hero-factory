import type { ErrorCode } from "@hero-factory/shared";
import { errorStatusByCode } from "@hero-factory/shared";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly fields: Record<string, string> | null;
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { fields?: Record<string, string> | null; details?: unknown },
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = errorStatusByCode[code];
    this.fields = options?.fields ?? null;
    this.details = options?.details;
  }
}

export function notFound(message: string): AppError {
  return new AppError("NOT_FOUND", message);
}

export function versionConflict(message: string, current: unknown): AppError {
  return new AppError("VERSION_CONFLICT", message, { details: { current } });
}

export function duplicateHero(message: string): AppError {
  return new AppError("DUPLICATE_HERO", message);
}

export function invalidState(message: string): AppError {
  return new AppError("INVALID_STATE", message);
}

export function scheduleConflict(message: string, details: unknown): AppError {
  return new AppError("SCHEDULE_CONFLICT", message, { details });
}

export function badRequest(message: string): AppError {
  return new AppError("BAD_REQUEST", message);
}
