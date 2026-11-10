import type { ErrorEnvelope } from "@hero-factory/shared";
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { AppError } from "./errors.js";

function fieldNameFromInstancePath(instancePath: string): string {
  return instancePath.replace(/^\//, "").replace(/\//g, ".") || "_";
}

function buildEnvelope(
  code: ErrorEnvelope["error"]["code"],
  message: string,
  fields: Record<string, string> | null = null,
  details?: unknown,
): ErrorEnvelope {
  return { error: { code, message, fields, details } };
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send(buildEnvelope(error.code, error.message, error.fields, error.details));
      return;
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      const fields: Record<string, string> = {};
      for (const issue of error.validation) {
        const fieldName = fieldNameFromInstancePath(issue.instancePath);
        fields[fieldName] = issue.message ?? "Campo inválido.";
      }
      reply
        .code(422)
        .send(buildEnvelope("VALIDATION_ERROR", "Alguns campos são inválidos.", fields));
      return;
    }

    if (error.statusCode === 400 || error.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
      reply
        .code(400)
        .send(buildEnvelope("BAD_REQUEST", "O pedido está malformado ou faltam dados obrigatórios."));
      return;
    }

    request.log.error(error);
    reply
      .code(500)
      .send(buildEnvelope("INTERNAL_ERROR", "Ocorreu um erro inesperado. Tente novamente."));
  });
}
