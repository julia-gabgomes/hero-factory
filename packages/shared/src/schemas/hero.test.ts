import { describe, expect, it } from "vitest";
import {
  createHeroSchema,
  heroChangeSchema,
  heroHistoryQuerySchema,
  heroMissionsQuerySchema,
  heroResponseSchema,
  listHeroesQuerySchema,
  updateHeroSchema,
} from "./hero.js";

function validCreateInput(): Record<string, unknown> {
  return {
    name: "Clark Kent",
    nickname: "Super-Homem",
    universe: "DC",
    main_power: "Voo",
    date_of_birth: "1990-06-18",
  };
}

describe("createHeroSchema", () => {
  it("aceita um objeto com todos os campos obrigatórios e sem avatar_url", () => {
    const result = createHeroSchema.safeParse(validCreateInput());

    expect(result.success).toBe(true);
  });

  it("rejeita um objeto sem o campo name, apontando name como obrigatório", () => {
    const input = validCreateInput();
    delete input.name;

    const result = createHeroSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "name"),
      ).toBe(true);
    }
  });

  it("rejeita nickname preenchido só com espaços, tratando como vazio", () => {
    const input = { ...validCreateInput(), nickname: "   " };

    const result = createHeroSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "nickname"),
      ).toBe(true);
    }
  });

  it("remove os espaços das pontas de name no valor validado", () => {
    const input = { ...validCreateInput(), name: "  Clark Kent  " };

    const result = createHeroSchema.safeParse(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Clark Kent");
    }
  });

  it("rejeita name com 121 code points, acima do limite", () => {
    const input = { ...validCreateInput(), name: "a".repeat(121) };

    const result = createHeroSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "name"),
      ).toBe(true);
    }
  });

  it("aceita name com exatamente 120 code points", () => {
    const input = { ...validCreateInput(), name: "a".repeat(120) };

    const result = createHeroSchema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it("aceita date_of_birth de ontem, que nunca é futura em nenhum fuso", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateOfBirth = [
      yesterday.getUTCFullYear(),
      String(yesterday.getUTCMonth() + 1).padStart(2, "0"),
      String(yesterday.getUTCDate()).padStart(2, "0"),
    ].join("-");
    const input = { ...validCreateInput(), date_of_birth: dateOfBirth };

    const result = createHeroSchema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it("rejeita date_of_birth claramente futura, apontando date_of_birth", () => {
    const input = { ...validCreateInput(), date_of_birth: "9999-01-01" };

    const result = createHeroSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "date_of_birth"),
      ).toBe(true);
    }
  });

  it("ignora campos controlados pelo servidor mesmo se enviados na criação", () => {
    const input = {
      ...validCreateInput(),
      id: "01990000-0000-7000-8000-000000000000",
      created_at: "2020-01-01T00:00:00Z",
      updated_at: "2020-01-01T00:00:00Z",
      deleted_at: "2020-01-01T00:00:00Z",
      version: 99,
    };

    const result = createHeroSchema.safeParse(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("id");
      expect(result.data).not.toHaveProperty("created_at");
      expect(result.data).not.toHaveProperty("updated_at");
      expect(result.data).not.toHaveProperty("deleted_at");
      expect(result.data).not.toHaveProperty("version");
    }
  });

  it("aceita avatar_url começando com https://", () => {
    const input = {
      ...validCreateInput(),
      avatar_url: "https://exemplo.com/avatar.png",
    };

    const result = createHeroSchema.safeParse(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.avatar_url).toBe("https://exemplo.com/avatar.png");
    }
  });

  it("aceita avatar_url começando com /uploads/", () => {
    const input = { ...validCreateInput(), avatar_url: "/uploads/avatar.png" };

    const result = createHeroSchema.safeParse(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.avatar_url).toBe("/uploads/avatar.png");
    }
  });

  it("rejeita avatar_url que não começa com http://, https:// ou /uploads/", () => {
    const input = {
      ...validCreateInput(),
      avatar_url: "ftp://exemplo.com/avatar.png",
    };

    const result = createHeroSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "avatar_url"),
      ).toBe(true);
    }
  });
  it("rejeita date_of_birth com dia que não existe no calendário, apontando date_of_birth", () => {
    const input = { ...validCreateInput(), date_of_birth: "2024-02-31" };

    const result = createHeroSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "date_of_birth"),
      ).toBe(true);
    }
  });

  it("trata avatar_url vazio como campo ausente, sem erro de formato", () => {
    const input = { ...validCreateInput(), avatar_url: "" };

    const result = createHeroSchema.safeParse(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.avatar_url).toBeUndefined();
    }
  });
});

describe("updateHeroSchema", () => {
  it("aceita um objeto com nickname e version preenchidos, sem exigir os demais campos", () => {
    const result = updateHeroSchema.safeParse({
      nickname: "Super-Homem",
      version: 1,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nickname).toBe("Super-Homem");
      expect(result.data).not.toHaveProperty("name");
      expect(result.data).not.toHaveProperty("universe");
      expect(result.data).not.toHaveProperty("main_power");
      expect(result.data).not.toHaveProperty("date_of_birth");
    }
  });

  it("rejeita universe preenchido só com espaços, do mesmo jeito que na criação", () => {
    const result = updateHeroSchema.safeParse({ universe: "   " });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "universe"),
      ).toBe(true);
    }
  });

  it("aceita um objeto com só version preenchido", () => {
    const result = updateHeroSchema.safeParse({ version: 3 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(3);
    }
  });

  it("rejeita um objeto sem o campo version, apontando version como obrigatório", () => {
    const result = updateHeroSchema.safeParse({ nickname: "Super" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "version"),
      ).toBe(true);
    }
  });
});

describe("heroResponseSchema", () => {
  function validHeroResponse(): Record<string, unknown> {
    return {
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
      created_at: "2024-05-01T10:00:00.000Z",
      updated_at: "2024-05-01T10:00:00.000Z",
    };
  }

  it("aceita uma resposta de herói válida, igual à devolvida pela API", () => {
    const result = heroResponseSchema.safeParse(validHeroResponse());

    expect(result.success).toBe(true);
  });

  it("aceita avatar_url e deleted_at nulos", () => {
    const result = heroResponseSchema.safeParse(validHeroResponse());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.avatar_url).toBeNull();
      expect(result.data.deleted_at).toBeNull();
    }
  });

  it("rejeita quando falta um campo obrigatório, como version", () => {
    const withoutVersion = validHeroResponse();
    delete withoutVersion.version;

    const result = heroResponseSchema.safeParse(withoutVersion);

    expect(result.success).toBe(false);
  });
});

describe("heroChangeSchema", () => {
  it("aceita uma linha de histórico com field, old_value e new_value preenchidos", () => {
    const result = heroChangeSchema.safeParse({
      event: "updated",
      field: "nickname",
      old_value: "Super",
      new_value: "Super-Homem",
      created_at: "2024-05-01T10:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });

  it("rejeita um event fora do conjunto conhecido", () => {
    const result = heroChangeSchema.safeParse({
      event: "renamed",
      field: "nickname",
      old_value: "Super",
      new_value: "Super-Homem",
      created_at: "2024-05-01T10:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });
});

describe("schemas de query de herói", () => {
  it("listHeroesQuerySchema aceita q e cursor opcionais", () => {
    expect(listHeroesQuerySchema.safeParse({}).success).toBe(true);
    expect(
      listHeroesQuerySchema.safeParse({ q: "joao", cursor: "abc" }).success,
    ).toBe(true);
  });

  it("heroHistoryQuerySchema aceita field, from, to e cursor opcionais", () => {
    expect(heroHistoryQuerySchema.safeParse({}).success).toBe(true);
    expect(
      heroHistoryQuerySchema.safeParse({
        field: "nickname",
        from: "2024-01-01T00:00:00.000Z",
        to: "2024-12-31T00:00:00.000Z",
        cursor: "abc",
      }).success,
    ).toBe(true);
  });

  it("heroMissionsQuerySchema aceita só situações válidas", () => {
    expect(
      heroMissionsQuerySchema.safeParse({ status: "succeeded" }).success,
    ).toBe(true);
    expect(
      heroMissionsQuerySchema.safeParse({ status: "pausada" }).success,
    ).toBe(false);
  });
});
