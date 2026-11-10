import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createHeroSchema, updateHeroSchema } from "@hero-factory/shared";
import { badRequest } from "../../http/errors.js";
import { createHero, getHeroById, listHeroesPage, updateHero } from "./service.js";

const heroParamsSchema = z.object({ id: z.string() });

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

  typedApp.get("/", async (_request, reply) => {
    const page = await listHeroesPage(app.db);

    reply.code(200).send(page);
  });

  typedApp.get(
    "/:id",
    { schema: { params: heroParamsSchema } },
    async (request, reply) => {
      const hero = await getHeroById(app.db, request.params.id);

      reply.code(200).send(hero);
    },
  );

  typedApp.patch(
    "/:id",
    { schema: { params: heroParamsSchema, body: updateHeroSchema } },
    async (request, reply) => {
      const hero = await updateHero(app.db, request.params.id, request.body);

      reply.code(200).send(hero);
    },
  );
}
