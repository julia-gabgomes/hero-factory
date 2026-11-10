import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { buildHeroFixture } from "../../../test/msw/fixtures.js";
import { server } from "../../../test/msw/server.js";
import { renderWithProviders } from "../../../test/render.js";
import { HeroFormDialog } from "./HeroFormDialog.js";

describe("HeroFormDialog - erro de campo da API", () => {
  it("aplica error.fields no campo certo quando a API devolve 422", async () => {
    server.use(
      http.post("/api/heroes", () => {
        return HttpResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Alguns campos são inválidos.",
              fields: { nickname: "Campo obrigatório." },
            },
          },
          { status: 422 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<HeroFormDialog open onOpenChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Nome completo"), "Clark Kent");
    await user.type(screen.getByLabelText("Nome de guerra"), "Super-Homem");
    await user.type(screen.getByLabelText("Universo"), "DC");
    await user.type(screen.getByLabelText("Habilidade"), "Voo");
    await user.type(screen.getByLabelText("Data de nascimento"), "1990-06-18");

    await user.click(screen.getByRole("button", { name: "Salvar" }));

    const fieldError = await screen.findByText("Campo obrigatório.");
    const fieldGroup = fieldError.closest("label");
    expect(fieldGroup).toHaveTextContent("Nome de guerra");
  });
});

describe("HeroFormDialog - 409 VERSION_CONFLICT com merge de três vias", () => {
  it("junta as edições e preserva o que a pessoa digitou", async () => {
    const baseHero = buildHeroFixture({
      id: "hero-1",
      nickname: "Super",
      universe: "DC",
      main_power: "Voo",
      version: 1,
    });

    server.use(
      http.patch("/api/heroes/:id", () => {
        return HttpResponse.json(
          {
            error: {
              code: "VERSION_CONFLICT",
              message: "O herói foi alterado por outra pessoa.",
              fields: null,
              details: {
                current: buildHeroFixture({
                  id: "hero-1",
                  nickname: "Super",
                  universe: "DC Comics",
                  main_power: "Voo",
                  version: 2,
                }),
              },
            },
          },
          { status: 409 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(
      <HeroFormDialog open onOpenChange={vi.fn()} hero={baseHero} />,
    );

    const nicknameInput = screen.getByLabelText("Nome de guerra");
    await user.clear(nicknameInput);
    await user.type(nicknameInput, "Super-Homem");

    await user.click(screen.getByRole("button", { name: "Salvar" }));

    // Campo que só eu mudei: mantém o que eu digitei.
    expect(await screen.findByDisplayValue("Super-Homem")).toBeInTheDocument();
    // Campo que só a outra pessoa mudou: recebe o valor dela.
    expect(screen.getByDisplayValue("DC Comics")).toBeInTheDocument();
  });
});
