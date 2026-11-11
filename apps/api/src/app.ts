import fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { Database } from "./db/client.js";
import { registerErrorHandler } from "./http/error-handler.js";
import { registerServerTiming } from "./http/server-timing.js";
import { heroRoutes } from "./modules/heroes/routes.js";
import { missionRoutes } from "./modules/missions/routes.js";

export interface AppDependencies {
  db: Database;
}

export function buildApp(deps: AppDependencies): FastifyInstance {
  const app = fastify().withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate("db", deps.db);
  registerErrorHandler(app);
  registerServerTiming(app);

  void app.register(heroRoutes, { prefix: "/heroes" });
  void app.register(missionRoutes, { prefix: "/missions" });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
}
