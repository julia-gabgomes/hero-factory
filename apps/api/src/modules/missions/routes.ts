import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  assignHeroToMissionSchema,
  createMissionSchema,
  finishMissionSchema,
  listMissionsQuerySchema,
} from "@hero-factory/shared";
import { badRequest } from "../../http/errors.js";
import {
  assignHeroToMission,
  cancelMission,
  createMission,
  finishMission,
  getMissionById,
  listMissionsPage,
  startMission,
  unassignHeroFromMission,
} from "./service.js";

const missionParamsSchema = z.object({ id: z.string() });
const missionHeroParamsSchema = z.object({
  id: z.string(),
  heroId: z.string(),
});
export function missionRoutes(app: FastifyInstance): void {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    "/",
    { schema: { body: createMissionSchema } },
    async (request, reply) => {
      const idempotencyKeyHeader = request.headers["idempotency-key"];
      if (
        typeof idempotencyKeyHeader !== "string" ||
        idempotencyKeyHeader.trim() === ""
      ) {
        throw badRequest("O cabeçalho Idempotency-Key é obrigatório.");
      }

      const result = await createMission(app.db, {
        body: request.body,
        idempotencyKey: idempotencyKeyHeader,
      });

      if (result.replayed) {
        reply.header("Idempotent-Replayed", "true");
      }

      reply.code(result.status).send(result.body);
    },
  );

  typedApp.get(
    "/",
    { schema: { querystring: listMissionsQuerySchema } },
    async (request, reply) => {
      const page = await listMissionsPage(app.db, {
        cursor: request.query.cursor,
        status: request.query.status,
      });

      reply.code(200).send(page);
    },
  );

  typedApp.get(
    "/:id",
    { schema: { params: missionParamsSchema } },
    async (request, reply) => {
      const mission = await getMissionById(app.db, request.params.id);

      reply.code(200).send(mission);
    },
  );

  typedApp.post(
    "/:id/start",
    { schema: { params: missionParamsSchema } },
    async (request, reply) => {
      const mission = await startMission(app.db, request.params.id);

      reply.code(200).send(mission);
    },
  );

  typedApp.post(
    "/:id/finish",
    { schema: { params: missionParamsSchema, body: finishMissionSchema } },
    async (request, reply) => {
      const mission = await finishMission(
        app.db,
        request.params.id,
        request.body.outcome,
      );

      reply.code(200).send(mission);
    },
  );

  typedApp.post(
    "/:id/cancel",
    { schema: { params: missionParamsSchema } },
    async (request, reply) => {
      const mission = await cancelMission(app.db, request.params.id);

      reply.code(200).send(mission);
    },
  );

  typedApp.post(
    "/:id/heroes",
    {
      schema: { params: missionParamsSchema, body: assignHeroToMissionSchema },
    },
    async (request, reply) => {
      const mission = await assignHeroToMission(app.db, {
        missionId: request.params.id,
        heroId: request.body.hero_id,
      });

      reply.code(201).send(mission);
    },
  );

  typedApp.delete(
    "/:id/heroes/:heroId",
    { schema: { params: missionHeroParamsSchema } },
    async (request, reply) => {
      const mission = await unassignHeroFromMission(app.db, {
        missionId: request.params.id,
        heroId: request.params.heroId,
      });

      reply.code(200).send(mission);
    },
  );
}
