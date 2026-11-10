import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { createHeroSchema } from "@hero-factory/shared";
import { badRequest } from "../../http/errors.js";
import { createHero } from "./service.js";

export function heroRoutes(app: FastifyInstance): void {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    "/",
    { schema: { body: createHeroSchema } },
    async (request, reply) => {
      const idempotencyKeyHeader = request.headers["idempotency-key"];
      if (typeof idempotencyKeyHeader !== "string" || idempotencyKeyHeader.trim() === "") {
        throw badRequest("O cabeçalho Idempotency-Key é obrigatório.");
      }

      const result = await createHero(app.db, {
        body: request.body,
        idempotencyKey: idempotencyKeyHeader,
      });

      if (result.replayed) {
        reply.header("Idempotent-Replayed", "true");
      }

      reply.code(result.status).send(result.body);
    },
  );
}
