import type { HeroChange } from "@hero-factory/shared";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { buildHeroChangeFixture } from "../../../test/msw/fixtures.js";
import { server } from "../../../test/msw/server.js";
import { renderWithProviders } from "../../../test/render.js";
import { HeroHistoryTab } from "./HeroHistoryTab.js";

function historyHandler(
  responder: (url: URL) => { data: HeroChange[]; next_cursor?: string | null },
) {
  return http.get("/api/heroes/:id/history", ({ request }) => {
    const url = new URL(request.url);
    const { data, next_cursor = null } = responder(url);
    return HttpResponse.json({ data, next_cursor, prev_cursor: null });
  });
}

describe("HeroHistoryTab - estados", () => {
  it("mostra carregando e depois a lista com sucesso", async () => {
    server.use(
      historyHandler(() => ({
        data: [buildHeroChangeFixture()],
      })),
    );

    renderWithProviders(<HeroHistoryTab heroId="hero-1" />);

    expect(screen.getByRole("status")).toBeInTheDocument();

    expect(
      await screen.findByText("Alterado · Nome de guerra"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("mostra erro com Tentar de novo quando a API falha, e recupera ao clicar", async () => {
    let shouldFail = true;
    server.use(
      http.get("/api/heroes/:id/history", () => {
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
          data: [buildHeroChangeFixture()],
          next_cursor: null,
          prev_cursor: null,
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<HeroHistoryTab heroId="hero-1" />);

    expect(
      await screen.findByText("Não foi possível carregar o histórico."),
    ).toBeInTheDocument();

    shouldFail = false;
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(
      await screen.findByText("Alterado · Nome de guerra"),
    ).toBeInTheDocument();
  });

  it("mostra 'nenhuma alteração registrada' quando a lista vem vazia sem filtro", async () => {
    server.use(historyHandler(() => ({ data: [] })));

    renderWithProviders(<HeroHistoryTab heroId="hero-1" />);

    expect(
      await screen.findByText("Nenhuma alteração registrada ainda."),
    ).toBeInTheDocument();
  });

  it("mostra mensagem diferente quando o filtro não encontra nada", async () => {
    server.use(historyHandler(() => ({ data: [] })));

    const user = userEvent.setup();
    renderWithProviders(<HeroHistoryTab heroId="hero-1" />);

    await screen.findByText("Nenhuma alteração registrada ainda.");

    await user.selectOptions(
      screen.getByLabelText("Campo alterado"),
      "main_power",
    );

    expect(
      await screen.findByText("Nenhuma alteração encontrada para esse filtro."),
    ).toBeInTheDocument();
  });
});

describe("HeroHistoryTab - filtros", () => {
  it("trocar o campo dispara a query com o filtro e reseta a paginação", async () => {
    let lastCursor: string | null = null;
    let lastField: string | null = null;
    server.use(
      historyHandler((url) => {
        lastCursor = url.searchParams.get("cursor");
        lastField = url.searchParams.get("field");
        if (lastCursor === null) {
          return {
            data: [buildHeroChangeFixture({ new_value: "Página 1" })],
            next_cursor: "cursor-pagina-2",
          };
        }
        return {
          data: [buildHeroChangeFixture({ new_value: "Página 2" })],
          next_cursor: null,
        };
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<HeroHistoryTab heroId="hero-1" />);

    await screen.findByText(/Página 1/);

    await user.click(screen.getByRole("button", { name: "Próxima página" }));
    await screen.findByText(/Página 2/);
    expect(lastCursor).toBe("cursor-pagina-2");

    await user.selectOptions(
      screen.getByLabelText("Campo alterado"),
      "main_power",
    );

    await waitFor(() => {
      expect(lastField).toBe("main_power");
    });
    expect(lastCursor).toBeNull();
  });

  it("filtra por período convertendo para ISO (início e fim do dia local)", async () => {
    let lastFrom: string | null = null;
    let lastTo: string | null = null;
    server.use(
      historyHandler((url) => {
        lastFrom = url.searchParams.get("from");
        lastTo = url.searchParams.get("to");
        return { data: [buildHeroChangeFixture()] };
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<HeroHistoryTab heroId="hero-1" />);
    await screen.findByText("Alterado · Nome de guerra");

    await user.type(screen.getByLabelText("De"), "2024-05-01");
    await user.type(screen.getByLabelText("Até"), "2024-05-02");

    await waitFor(() => {
      expect(lastFrom).not.toBeNull();
    });
    expect(lastFrom).toBe(new Date("2024-05-01T00:00").toISOString());
    expect(lastTo).toBe(new Date("2024-05-02T23:59:59.999").toISOString());
  });

  it("'Limpar filtros' remove os filtros e volta à página 1", async () => {
    let lastField: string | null = null;
    server.use(
      historyHandler((url) => {
        lastField = url.searchParams.get("field");
        return { data: [buildHeroChangeFixture()] };
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<HeroHistoryTab heroId="hero-1" />);
    await screen.findByText("Alterado · Nome de guerra");

    await user.selectOptions(
      screen.getByLabelText("Campo alterado"),
      "main_power",
    );
    await waitFor(() => {
      expect(lastField).toBe("main_power");
    });

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));

    await waitFor(() => {
      expect(lastField).toBeNull();
    });
    expect(
      screen.queryByRole("button", { name: "Limpar filtros" }),
    ).not.toBeInTheDocument();
  });
});
