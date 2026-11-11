import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import {
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { buildHeroFixture } from "../../../test/msw/fixtures.js";
import { server } from "../../../test/msw/server.js";
import { renderWithProviders } from "../../../test/render.js";
import { HeroesPage } from "./HeroesPage.js";

describe("HeroesPage - estados da lista", () => {
  it("mostra carregando e depois a lista com sucesso", async () => {
    renderWithProviders(<HeroesPage />, { initialEntries: ["/heroes"] });

    expect(screen.getByRole("status")).toBeInTheDocument();

    expect(await screen.findByText("Super-Homem")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("mostra erro com Tentar de novo quando a API falha, e recupera ao clicar", async () => {
    let shouldFail = true;
    server.use(
      http.get("/api/heroes", () => {
        if (shouldFail) {
          return HttpResponse.json(
            {
              error: {
                code: "INTERNAL_ERROR",
                message: "Falhou",
                fields: null,
              },
            },
            { status: 500 },
          );
        }
        return HttpResponse.json({
          data: [buildHeroFixture()],
          next_cursor: null,
          prev_cursor: null,
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<HeroesPage />, { initialEntries: ["/heroes"] });

    expect(
      await screen.findByText("Não foi possível carregar os heróis."),
    ).toBeInTheDocument();

    shouldFail = false;
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("Super-Homem")).toBeInTheDocument();
  });

  it("mostra 'nenhum herói cadastrado' quando a lista vem vazia sem busca", async () => {
    server.use(
      http.get("/api/heroes", () => {
        return HttpResponse.json({
          data: [],
          next_cursor: null,
          prev_cursor: null,
        });
      }),
    );

    renderWithProviders(<HeroesPage />, { initialEntries: ["/heroes"] });

    expect(
      await screen.findByText("Nenhum herói cadastrado"),
    ).toBeInTheDocument();
  });

  it("mostra 'nenhum resultado' (mensagem diferente) quando a busca não encontra nada", async () => {
    server.use(
      http.get("/api/heroes", () => {
        return HttpResponse.json({
          data: [],
          next_cursor: null,
          prev_cursor: null,
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<HeroesPage />, { initialEntries: ["/heroes"] });

    await waitForElementToBeRemoved(() => screen.queryByRole("status"));

    await user.type(
      screen.getByRole("searchbox", { name: /buscar herói/i }),
      "zzz",
    );
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => {
      expect(
        screen.getByText('Nenhum resultado para "zzz"'),
      ).toBeInTheDocument();
    });
  });
});
