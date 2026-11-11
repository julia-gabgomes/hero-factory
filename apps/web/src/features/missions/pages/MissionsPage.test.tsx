import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { buildMissionListItemFixture } from "../../../test/msw/fixtures.js";
import { server } from "../../../test/msw/server.js";
import { renderWithProviders } from "../../../test/render.js";
import { MissionsPage } from "./MissionsPage.js";

function missionsHandler(
  responder: (url: URL) => {
    data: ReturnType<typeof buildMissionListItemFixture>[];
  },
) {
  return http.get("/api/missions", ({ request }) => {
    const url = new URL(request.url);
    const { data } = responder(url);
    return HttpResponse.json({ data, next_cursor: null, prev_cursor: null });
  });
}

describe("MissionsPage - estados da lista", () => {
  it("mostra carregando e depois a lista com sucesso", async () => {
    renderWithProviders(<MissionsPage />, { initialEntries: ["/missions"] });

    expect(screen.getByRole("status")).toBeInTheDocument();

    expect(await screen.findByText("Resgate no centro")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("mostra erro com Tentar de novo quando a API falha, e recupera ao clicar", async () => {
    let shouldFail = true;
    server.use(
      http.get("/api/missions", () => {
        if (shouldFail) {
          return HttpResponse.json(
            { error: { code: "INTERNAL_ERROR", message: "Falhou", fields: null } },
            { status: 500 },
          );
        }
        return HttpResponse.json({
          data: [buildMissionListItemFixture()],
          next_cursor: null,
          prev_cursor: null,
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<MissionsPage />, { initialEntries: ["/missions"] });

    expect(
      await screen.findByText("Não foi possível carregar as missões."),
    ).toBeInTheDocument();

    shouldFail = false;
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("Resgate no centro")).toBeInTheDocument();
  });

  it("mostra 'nenhuma missão cadastrada' quando a lista vem vazia", async () => {
    server.use(
      http.get("/api/missions", () => {
        return HttpResponse.json({
          data: [],
          next_cursor: null,
          prev_cursor: null,
        });
      }),
    );

    renderWithProviders(<MissionsPage />, { initialEntries: ["/missions"] });

    expect(
      await screen.findByText("Nenhuma missão cadastrada"),
    ).toBeInTheDocument();
  });
});

describe("MissionsPage - filtro de situação", () => {
  it("clicar num chip dispara a query com o status correspondente e marca aria-pressed", async () => {
    let lastStatus: string | null = null;
    server.use(
      missionsHandler((url) => {
        lastStatus = url.searchParams.get("status");
        return { data: [buildMissionListItemFixture()] };
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<MissionsPage />, { initialEntries: ["/missions"] });

    await screen.findByText("Resgate no centro");

    const chip = screen.getByRole("button", { name: "Agendada" });
    expect(chip).toHaveAttribute("aria-pressed", "false");

    await user.click(chip);

    await waitFor(() => {
      expect(chip).toHaveAttribute("aria-pressed", "true");
    });
    expect(lastStatus).toBe("scheduled");
  });

  it("clicar em dois chips soma os status selecionados", async () => {
    let lastStatus: string | null = null;
    server.use(
      missionsHandler((url) => {
        lastStatus = url.searchParams.get("status");
        return { data: [buildMissionListItemFixture()] };
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<MissionsPage />, { initialEntries: ["/missions"] });

    await screen.findByText("Resgate no centro");

    await user.click(screen.getByRole("button", { name: "Agendada" }));
    await user.click(screen.getByRole("button", { name: "Fracasso" }));

    await waitFor(() => {
      expect(lastStatus).toBe("scheduled,failed");
    });
  });

  it("clicar de novo no mesmo chip remove o status (toggle) e some da URL", async () => {
    let lastStatus: string | null = null;
    server.use(
      missionsHandler((url) => {
        lastStatus = url.searchParams.get("status");
        return { data: [buildMissionListItemFixture()] };
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<MissionsPage />, { initialEntries: ["/missions"] });

    await screen.findByText("Resgate no centro");

    const chip = screen.getByRole("button", { name: "Agendada" });
    await user.click(chip);
    await waitFor(() => {
      expect(lastStatus).toBe("scheduled");
    });

    await user.click(chip);
    await waitFor(() => {
      expect(lastStatus).toBeNull();
    });
    expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  it("chega com o chip já marcado via deep-link e dispara a query com o status da URL", async () => {
    let lastStatus: string | null = null;
    server.use(
      missionsHandler((url) => {
        lastStatus = url.searchParams.get("status");
        return { data: [buildMissionListItemFixture({ status: "failed" })] };
      }),
    );

    renderWithProviders(<MissionsPage />, {
      initialEntries: ["/missions?status=failed"],
    });

    await screen.findByText("Resgate no centro");

    expect(screen.getByRole("button", { name: "Fracasso" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(lastStatus).toBe("failed");
  });
});
