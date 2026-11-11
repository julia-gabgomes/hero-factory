import { describe, expect, it } from "vitest";
import { createMissionSchema, missionStatusSchema } from "./mission.js";

// Nomes e assinaturas adotados (a etapa não os fixa):
// - `createMissionSchema`: schema de criação de missão. Campo `title`
//   obrigatório, com `trim()` aplicado antes de validar (texto só com
//   espaços conta como vazio) e limite de `limits.mission.title` (120 code
//   points). `starts_at`/`ends_at` são datas e horas ISO 8601 em UTC
//   (com `Z`), obrigatórias, com `ends_at` estritamente depois de
//   `starts_at`. Campo `status`, se enviado, é ignorado e não aparece no
//   valor validado.
// - `missionStatusSchema`: schema de um único valor de situação, aceitando
//   somente `scheduled`, `in_progress`, `succeeded`, `failed` ou
//   `cancelled`.

const validTimes = {
  starts_at: "2024-05-01T10:00:00.000Z",
  ends_at: "2024-05-01T12:00:00.000Z",
};

describe("createMissionSchema", () => {
  // Etapa 06 · C1.a — Dado um objeto com title = "Resgate no centro" e
  // horários válidos, quando se valida contra o schema de criação, então a
  // validação passa.
  it("aceita um objeto com title preenchido", () => {
    const result = createMissionSchema.safeParse({
      title: "Resgate no centro",
      ...validTimes,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Resgate no centro");
    }
  });

  // Etapa 06 · C1.b — Dado um objeto com title = "   " (só espaços), quando
  // se valida contra o schema de criação, então a validação falha apontando
  // title como obrigatório.
  it("rejeita title preenchido só com espaços, apontando title como obrigatório", () => {
    const result = createMissionSchema.safeParse({
      title: "   ",
      ...validTimes,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "title"),
      ).toBe(true);
    }
  });

  // Etapa 06 · C2.a — Dado um objeto com title tendo 121 code points, quando
  // se valida contra o schema de criação, então a validação falha apontando
  // o limite de title.
  it("rejeita title com 121 code points, acima do limite", () => {
    const result = createMissionSchema.safeParse({
      title: "a".repeat(121),
      ...validTimes,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "title"),
      ).toBe(true);
    }
  });

  // Etapa 06 · C2.b — Dado um objeto com title tendo exatamente 120 code
  // points, quando se valida contra o schema de criação, então a validação
  // passa.
  it("aceita title com exatamente 120 code points", () => {
    const result = createMissionSchema.safeParse({
      title: "a".repeat(120),
      ...validTimes,
    });

    expect(result.success).toBe(true);
  });

  // Etapa 06 · C3.a — Dado um objeto válido de criação com
  // status = "succeeded" preenchido arbitrariamente, quando se valida
  // contra o schema de criação, então o valor resultante não contém o campo
  // status.
  it("ignora o campo status mesmo se enviado na criação", () => {
    const result = createMissionSchema.safeParse({
      title: "Resgate no centro",
      ...validTimes,
      status: "succeeded",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("status");
    }
  });

  // Fase 4 · lock e choque de horário — Dado um objeto com ends_at igual a
  // starts_at, quando se valida contra o schema de criação, então a
  // validação falha apontando ends_at.
  it("rejeita ends_at igual a starts_at, apontando ends_at", () => {
    const result = createMissionSchema.safeParse({
      title: "Resgate no centro",
      starts_at: "2024-05-01T10:00:00.000Z",
      ends_at: "2024-05-01T10:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "ends_at"),
      ).toBe(true);
    }
  });

  // Fase 4 · lock e choque de horário — Dado um objeto com ends_at antes de
  // starts_at, quando se valida contra o schema de criação, então a
  // validação falha apontando ends_at.
  it("rejeita ends_at antes de starts_at, apontando ends_at", () => {
    const result = createMissionSchema.safeParse({
      title: "Resgate no centro",
      starts_at: "2024-05-01T12:00:00.000Z",
      ends_at: "2024-05-01T10:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "ends_at"),
      ).toBe(true);
    }
  });

  // Fase 4 · lock e choque de horário — Dado um objeto com starts_at num
  // formato que não é uma data-hora ISO 8601 em UTC, quando se valida
  // contra o schema de criação, então a validação falha apontando
  // starts_at.
  it("rejeita starts_at que não é uma data-hora ISO 8601 UTC", () => {
    const result = createMissionSchema.safeParse({
      title: "Resgate no centro",
      starts_at: "01/05/2024 10:00",
      ends_at: validTimes.ends_at,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "starts_at"),
      ).toBe(true);
    }
  });

  // Fase 4 · lock e choque de horário — Início no passado é permitido,
  // porque a situação da missão não depende do relógio.
  it("aceita starts_at no passado", () => {
    const result = createMissionSchema.safeParse({
      title: "Resgate no centro",
      starts_at: "2000-01-01T00:00:00.000Z",
      ends_at: "2000-01-01T02:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });
});

describe("missionStatusSchema", () => {
  // Etapa 06 · C4.a — Dado o valor "in_progress", quando se valida contra o
  // schema de transição de situação, então a validação passa.
  it("aceita o valor in_progress", () => {
    const result = missionStatusSchema.safeParse("in_progress");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("in_progress");
    }
  });

  // Etapa 06 · C4.b — Dado o valor "pausada" (não é uma situação válida),
  // quando se valida contra o schema de transição de situação, então a
  // validação falha.
  it("rejeita o valor pausada, que não é uma situação válida", () => {
    const result = missionStatusSchema.safeParse("pausada");

    expect(result.success).toBe(false);
  });
});
