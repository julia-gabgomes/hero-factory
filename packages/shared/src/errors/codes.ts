export const errorStatusByCode = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  SCHEDULE_CONFLICT: 409,
  INVALID_STATE: 409,
  DUPLICATE_HERO: 409,
  IDEMPOTENCY_KEY_MISMATCH: 422,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof errorStatusByCode;
