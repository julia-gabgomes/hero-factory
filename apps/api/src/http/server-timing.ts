import { AsyncLocalStorage } from "node:async_hooks";
import type { FastifyInstance } from "fastify";

export interface TimingContext {
  start: number;
  dbMs: number;
}

const timingStorage = new AsyncLocalStorage<TimingContext>();

export function recordDbTime(ms: number): void {
  const context = timingStorage.getStore();
  if (context) {
    context.dbMs += ms;
  }
}

export function registerServerTiming(app: FastifyInstance): void {
  app.addHook("onRequest", (_request, _reply, done) => {
    timingStorage.enterWith({ start: performance.now(), dbMs: 0 });
    done();
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    const context = timingStorage.getStore();
    if (context) {
      const totalMs = performance.now() - context.start;
      reply.header(
        "Server-Timing",
        `db;dur=${context.dbMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`,
      );
    }
    return payload;
  });
}
