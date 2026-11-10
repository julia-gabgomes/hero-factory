import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { idempotencyKeys } from "../db/schema/idempotency_keys.js";
import { AppError } from "./errors.js";

const ER_DUP_ENTRY = "ER_DUP_ENTRY";

type TransactionCallback = Parameters<Database["transaction"]>[0];
export type IdempotencyTransaction = Parameters<TransactionCallback>[0];

export interface IdempotencyFnResult<T> {
  status: number;
  body: T;
}

export interface IdempotencyResult<T> extends IdempotencyFnResult<T> {
  replayed: boolean;
}

export interface IdempotencyKey {
  scope: string;
  key: string;
  requestHash: string;
}

export class IdempotencyKeyMismatchError extends AppError {
  constructor(
    message = "A mesma chave de idempotência já foi usada com um corpo diferente.",
  ) {
    super("IDEMPOTENCY_KEY_MISMATCH", message);
    this.name = "IdempotencyKeyMismatchError";
  }
}

function hasDuplicateEntryCode(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === ER_DUP_ENTRY
  );
}

function isDuplicateEntryError(error: unknown): boolean {
  if (hasDuplicateEntryCode(error)) {
    return true;
  }
  if (error instanceof Error && "cause" in error) {
    return hasDuplicateEntryCode((error as { cause?: unknown }).cause);
  }
  return false;
}

async function readExistingResponse<T>(
  tx: IdempotencyTransaction,
  { scope, key, requestHash }: IdempotencyKey,
): Promise<IdempotencyResult<T>> {
  const rows = await tx
    .select()
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)))
    .for("update");

  const existing = rows[0];
  if (!existing) {
    // Defensivo: só chegamos aqui depois que o INSERT falhou por duplicidade
    // de (scope, key), então a linha precisa existir. Sem teste porque não
    // há como forçar essa condição via Testcontainers sem mockar o driver.
    throw new Error(
      "Chave de idempotência não encontrada depois de um conflito de inserção.",
    );
  }

  if (existing.request_hash !== requestHash) {
    throw new IdempotencyKeyMismatchError();
  }

  return {
    status: existing.response_status,
    body: JSON.parse(existing.response_body) as T,
    replayed: true,
  };
}

export async function withIdempotency<T>(
  db: Database,
  params: IdempotencyKey,
  fn: (tx: IdempotencyTransaction) => Promise<IdempotencyFnResult<T>>,
): Promise<IdempotencyResult<T>> {
  const { scope, key, requestHash } = params;

  return db.transaction(async (tx) => {
    try {
      await tx.insert(idempotencyKeys).values({
        scope,
        key,
        request_hash: requestHash,
        response_status: 0,
        response_body: "",
        created_at: new Date(),
      });
    } catch (error) {
      if (!isDuplicateEntryError(error)) {
        throw error;
      }
      return readExistingResponse<T>(tx, params);
    }

    const result = await fn(tx);

    await tx
      .update(idempotencyKeys)
      .set({
        response_status: result.status,
        response_body: JSON.stringify(result.body),
      })
      .where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)));

    return { ...result, replayed: false };
  });
}
