import { describe, expect, it } from "vitest";
import {
  createMissionSchema,
  listMissionsQuerySchema,
  missionDetailSchema,
  missionResponseSchema,
  missionStatusListSchema,
  missionStatusSchema,
} from "./mission.js";

const validTimes = {
  starts_at: "2024-05-01T10:00:00.000Z",
  ends_at: "2024-05-01T12:00:00.000Z",
};

describe("createMissionSchema", () => {
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

  it("aceita title com exatamente 120 code points", () => {
    const result = createMissionSchema.safeParse({
      title: "a".repeat(120),
      ...validTimes,
    });

    expect(result.success).toBe(true);
  });

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
  it("aceita o valor in_progress", () => {
    const result = missionStatusSchema.safeParse("in_progress");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("in_progress");
    }
  });

  it("rejeita o valor pausada, que não é uma situação válida", () => {
    const result = missionStatusSchema.safeParse("pausada");

    expect(result.success).toBe(false);
  });
});

describe("missionResponseSchema", () => {
  function validMissionResponse(): Record<string, unknown> {
    return {
      id: "01971f6e-0000-7000-8000-000000000001",
      title: "Resgate no centro",
      status: "scheduled",
      starts_at: "2024-05-01T10:00:00.000Z",
      ends_at: "2024-05-01T12:00:00.000Z",
      created_at: "2024-05-01T09:00:00.000Z",
      updated_at: "2024-05-01T09:00:00.000Z",
    };
  }

  it("aceita uma resposta de missão válida, igual à devolvida pela API", () => {
    const result = missionResponseSchema.safeParse(validMissionResponse());

    expect(result.success).toBe(true);
  });

  it("rejeita um status fora do conjunto conhecido", () => {
    const result = missionResponseSchema.safeParse({
      ...validMissionResponse(),
      status: "pausada",
    });

    expect(result.success).toBe(false);
  });
});

describe("missionDetailSchema", () => {
  it("aceita uma missão com a lista de heróis escalados", () => {
    const result = missionDetailSchema.safeParse({
      id: "01971f6e-0000-7000-8000-000000000001",
      title: "Resgate no centro",
      status: "in_progress",
      starts_at: "2024-05-01T10:00:00.000Z",
      ends_at: "2024-05-01T12:00:00.000Z",
      created_at: "2024-05-01T09:00:00.000Z",
      updated_at: "2024-05-01T09:00:00.000Z",
      heroes: [
        {
          id: "01971f6e-0000-7000-8000-000000000000",
          name: "Clark Kent",
          nickname: "Super-Homem",
          universe: "DC",
          main_power: "Voo",
          date_of_birth: "1990-06-18",
          avatar_url: null,
          is_active: true,
          deleted_at: null,
          version: 1,
          created_at: "2024-05-01T08:00:00.000Z",
          updated_at: "2024-05-01T08:00:00.000Z",
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.heroes).toHaveLength(1);
    }
  });

  it("aceita uma missão sem nenhum herói escalado", () => {
    const result = missionDetailSchema.safeParse({
      id: "01971f6e-0000-7000-8000-000000000001",
      title: "Resgate no centro",
      status: "scheduled",
      starts_at: "2024-05-01T10:00:00.000Z",
      ends_at: "2024-05-01T12:00:00.000Z",
      created_at: "2024-05-01T09:00:00.000Z",
      updated_at: "2024-05-01T09:00:00.000Z",
      heroes: [],
    });

    expect(result.success).toBe(true);
  });
});

describe("listMissionsQuerySchema", () => {
  it("aceita cursor opcional", () => {
    expect(listMissionsQuerySchema.safeParse({}).success).toBe(true);
    expect(listMissionsQuerySchema.safeParse({ cursor: "abc" }).success).toBe(
      true,
    );
  });

  it("aceita status ausente", () => {
    const result = listMissionsQuerySchema.safeParse({ cursor: "abc" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBeUndefined();
    }
  });

  it("aceita status como lista CSV e devolve um array", () => {
    const result = listMissionsQuerySchema.safeParse({
      status: "scheduled,failed",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toEqual(["scheduled", "failed"]);
    }
  });

  it("rejeita um status inválido dentro da lista", () => {
    const result = listMissionsQuerySchema.safeParse({
      status: "scheduled,pausada",
    });

    expect(result.success).toBe(false);
  });
});

describe("missionStatusListSchema", () => {
  it("transforma uma string CSV num array de situações", () => {
    const result = missionStatusListSchema.safeParse("scheduled,failed");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(["scheduled", "failed"]);
    }
  });

  it("aceita um array vindo diretamente, como numa chave repetida do Fastify", () => {
    const result = missionStatusListSchema.safeParse(["scheduled", "failed"]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(["scheduled", "failed"]);
    }
  });

  it("ignora espaços nas pontas de cada item", () => {
    const result = missionStatusListSchema.safeParse(" scheduled , failed ");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(["scheduled", "failed"]);
    }
  });

  it.each([undefined, null, ""])(
    "trata %p como ausência de filtro",
    (value) => {
      const result = missionStatusListSchema.safeParse(value);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeUndefined();
      }
    },
  );

  it("rejeita um valor que não é uma situação conhecida", () => {
    const result = missionStatusListSchema.safeParse("pausada");

    expect(result.success).toBe(false);
  });
});
