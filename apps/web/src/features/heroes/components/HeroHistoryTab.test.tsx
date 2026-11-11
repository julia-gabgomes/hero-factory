import type { HeroChange } from "@hero-factory/shared";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor, within } from "@testing-library/react";
import { dateTimeLocalToIsoUtc, todayAsDateInputValue } from "../../../lib/dates.js";
import { buildHeroChangeFixture } from "../../../test/msw/fixtures.js";
import { server } from "../../../test/msw/server.js";
import { renderWithProviders } from "../../../test/render.js";
import { HeroHistoryTab } from "./HeroHistoryTab.js";

interface HistoryResponderResult {
  data?: HeroChange[];
  next_cursor?: string | null;
  total?: number;
  field_totals?: Record<string, number>;
}

function historyHandler(responder: (url: URL) => HistoryResponderResult) {
  return http.get("/api/heroes/:id/history", ({ request }) => {
    const url = new URL(request.url);
    const result = responder(url);
    const data = result.data ?? [];
    return HttpResponse.json({
      data,
      next_cursor: result.next_cursor ?? null,
      prev_cursor: null,
      total: result.total ?? data.length,
      field_totals: result.field_totals ?? {},
    });
  });
}

describe("HeroHistoryTab - estados", () => {
  it("mostra carregando e depois a lista com sucesso", async () => {
    server.use(
      historyHandler(() => ({
        data: [buildHeroChangeFixture()],
        total: 1,
        field_totals: { nickname: 1 },
      })),
    );

    renderWithProviders(<HeroHistoryTab heroId="hero-1" />);

    expect(screen.getByRole("status")).toBeInTheDocument();

    await screen.findByText("Alterado");
    const item = within(screen.getByRole("listitem"));
    expect(item.getByText("Alterado")).toBeInTheDocument();
    expect(item.getByText("Nome de guerra")).toBeInTheDocument();
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
          total: 1,
          field_totals: { nickname: 1 },
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

    expect(await screen.findByText("Alterado")).toBeInTheDocument();
  });

  it("mostra 'nenhuma alteração registrada' quando a lista vem vazia sem filtro", async () => {
    server.use(historyHandler(() => ({ data: [], total: 0 })));

    renderWithProviders(<HeroHistoryTab heroId="hero-1" />);

    expect(
      await screen.findByText("Nenhuma alteração registrada ainda."),
    ).toBeInTheDocument();
  });

  it("mostra mensagem diferente quando o filtro não encontra nada", async () => {
    server.use(
      historyHandler(() => ({
        data: [],
        total: 0,
        field_totals: { main_power: 0 },
      })),
    );

    const user = userEvent.setup();
    renderWithProviders(<HeroHistoryTab heroId="hero-1" />);

    await screen.findByText("Nenhuma alteração registrada ainda.");

    await user.click(screen.getByRole("button", { name: /Poderes/ }));

    expect(
      await screen.findByText("Nenhuma alteração encontrada"),
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
            total: 2,
            field_totals: { nickname: 2 },
          };
        }
        return {
          data: [buildHeroChangeFixture({ new_value: "Página 2" })],
          next_cursor: null,
          total: 2,
          field_totals: { nickname: 2 },
        };
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<HeroHistoryTab heroId="hero-1" />);

    await screen.findByText(/Página 1/);

    await user.click(screen.getByRole("button", { name: "Próxima página" }));
    await screen.findByText(/Página 2/);
    expect(lastCursor).toBe("cursor-pagina-2");

    await user.click(screen.getByRole("button", { name: /Poderes/ }));

    await waitFor(() => {
      expect(lastField).toBe("main_power");
    });
    expect(lastCursor).toBeNull();
  });

  it("filtra por período usando o atalho 'Hoje', convertendo para ISO (início e fim do dia local)", async () => {
    let lastFrom: string | null = null;
    let lastTo: string | null = null;
    server.use(
      historyHandler((url) => {
        lastFrom = url.searchParams.get("from");
        lastTo = url.searchParams.get("to");
        return { data: [buildHeroChangeFixture()], total: 1 };
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<HeroHistoryTab heroId="hero-1" />);
    await screen.findByText("Alterado");

    await user.click(screen.getByRole("button", { name: /Qualquer data/ }));
    await user.click(await screen.findByRole("button", { name: "Hoje" }));

    await waitFor(() => {
      expect(lastFrom).not.toBeNull();
    });

    const today = todayAsDateInputValue();
    expect(lastFrom).toBe(dateTimeLocalToIsoUtc(`${today}T00:00`));
    expect(lastTo).toBe(dateTimeLocalToIsoUtc(`${today}T23:59:59.999`));
    expect(screen.getByRole("button", { name: /Hoje/ })).toBeInTheDocument();
  });

  it("'Limpar filtros' remove os filtros e volta à página 1", async () => {
    let lastField: string | null = null;
    server.use(
      historyHandler((url) => {
        lastField = url.searchParams.get("field");
        return {
          data: [buildHeroChangeFixture()],
          total: 1,
          field_totals: { nickname: 1 },
        };
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<HeroHistoryTab heroId="hero-1" />);
    await screen.findByText("Alterado");

    await user.click(screen.getByRole("button", { name: /Poderes/ }));
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
