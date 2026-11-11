import { lt } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { idempotencyKeys } from "../db/schema/idempotency_keys.js";

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export async function deleteExpiredIdempotencyKeys(
  db: Database,
  now: Date = new Date(),
): Promise<number> {
  const threshold = new Date(now.getTime() - MAX_AGE_MS);

  const result = await db
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.created_at, threshold));

  return result[0].affectedRows;
}

// Roda em cada instância da API (não só numa delas): o DELETE é idempotente
// e seguro sob concorrência, então não precisa de lock nem de um processo
// dedicado para isso. Só é ligado em server.ts, nunca em buildApp(), para
// não deixar o timer vivo nos testes.
export function startIdempotencyCleanup(db: Database): () => void {
  const timer = setInterval(() => {
    deleteExpiredIdempotencyKeys(db).catch((error: unknown) => {
      console.error("Falha ao limpar idempotency_keys expiradas", error);
    });
  }, CLEANUP_INTERVAL_MS);

  timer.unref();

  return () => clearInterval(timer);
}
