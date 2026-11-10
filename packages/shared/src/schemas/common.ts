import { z } from "zod";
import { errorStatusByCode, type ErrorCode } from "../errors/codes.js";

const errorCodeSchema = z.enum(
  Object.keys(errorStatusByCode) as [ErrorCode, ...ErrorCode[]],
);

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    fields: z.record(z.string(), z.string()).nullable(),
    details: z.unknown().optional(),
  }),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

export function cursorPageSchema<ItemSchema extends z.ZodType>(
  itemSchema: ItemSchema,
) {
  return z.object({
    data: z.array(itemSchema),
    next_cursor: z.string().nullable(),
    prev_cursor: z.string().nullable(),
  });
}

export type CursorPage<ItemSchema extends z.ZodType> = z.infer<
  ReturnType<typeof cursorPageSchema<ItemSchema>>
>;

export const idempotencyKeySchema = z.string().uuid();

export type IdempotencyKey = z.infer<typeof idempotencyKeySchema>;

export const versionOnlyBodySchema = z.object({
  version: z.number().int(),
});

export type VersionOnlyBody = z.infer<typeof versionOnlyBodySchema>;
