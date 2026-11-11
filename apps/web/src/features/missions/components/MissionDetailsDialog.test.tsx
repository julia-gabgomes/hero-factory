import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import {
  buildHeroFixture,
  buildMissionFixture,
} from "../../../test/msw/fixtures.js";
import { server } from "../../../test/msw/server.js";
import { renderWithProviders } from "../../../test/render.js";
import { MissionDetailsDialog } from "./MissionDetailsDialog.js";

function missionHandler(mission: ReturnType<typeof buildMissionFixture>) {
  return http.get("/api/missions/:id", () => HttpResponse.json(mission));
}

function renderDialog() {
  renderWithProviders(
    <MissionDetailsDialog missionId="mission-1" open onOpenChange={() => {}} />,
  );
}

describe("MissionDetailsDialog - estados", () => {
  it("mostra carregando e depois os detalhes com sucesso", async () => {
    server.use(missionHandler(buildMissionFixture()));
    renderDialog();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(await screen.findByText("Resgate no centro")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("mostra erro com Tentar de novo quando a API falha, e recupera ao clicar", async () => {
    let shouldFail = true;
    server.use(
      http.get("/api/missions/:id", () => {
        if (shouldFail) {
          return HttpResponse.json(
            { error: { code: "INTERNAL_ERROR", message: "Falhou", fields: null } },
            { status: 500 },
          );
        }
        return HttpResponse.json(buildMissionFixture());
      }),
    );

    const user = userEvent.setup();
    renderDialog();

    expect(
      await screen.findByText("Não foi possível carregar a missão."),
    ).toBeInTheDocument();

    shouldFail = false;
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("Resgate no centro")).toBeInTheDocument();
  });
});

describe("MissionDetailsDialog - ações por situação", () => {
  it("agendada: mostra Iniciar e Cancelar missão, sem ações de encerrar", async () => {
    server.use(missionHandler(buildMissionFixture({ status: "scheduled" })));
    renderDialog();

    await screen.findByText("Resgate no centro");

    expect(screen.getByRole("button", { name: "Iniciar" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancelar missão" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Encerrar com sucesso" }),
    ).not.toBeInTheDocument();
  });

  it("em andamento: mostra as duas ações de encerrar e Cancelar missão, sem Iniciar", async () => {
    server.use(missionHandler(buildMissionFixture({ status: "in_progress" })));
    renderDialog();

    await screen.findByText("Resgate no centro");

    expect(
      screen.getByRole("button", { name: "Encerrar com sucesso" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Encerrar com fracasso" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancelar missão" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Iniciar" }),
    ).not.toBeInTheDocument();
  });

  it.each(["succeeded", "failed", "cancelled"] as const)(
    "%s: não mostra nenhuma ação",
    async (status) => {
      server.use(missionHandler(buildMissionFixture({ status })));
      renderDialog();

      await screen.findByText("Resgate no centro");

      expect(
        screen.queryByRole("button", { name: "Iniciar" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Encerrar com sucesso" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Cancelar missão" }),
      ).not.toBeInTheDocument();
    },
  );
});

describe("MissionDetailsDialog - confirmação antes de cancelar/encerrar", () => {
  it("cancelar pede confirmação e só chama a API depois de confirmar", async () => {
    const cancelSpy = vi.fn();
    server.use(
      missionHandler(buildMissionFixture({ status: "scheduled" })),
      http.post("/api/missions/:id/cancel", () => {
        cancelSpy();
        return HttpResponse.json(buildMissionFixture({ status: "cancelled" }));
      }),
    );

    const user = userEvent.setup();
    renderDialog();

    await screen.findByText("Resgate no centro");
    await user.click(screen.getByRole("button", { name: "Cancelar missão" }));

    expect(
      await screen.findByText(
        /Cancelar a missão "Resgate no centro"\? Essa ação não pode ser desfeita\./,
      ),
    ).toBeInTheDocument();
    expect(cancelSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(cancelSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancelar missão" }));
    await user.click(screen.getByRole("button", { name: "Sim, cancelar" }));

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("encerrar com sucesso pede confirmação e só chama a API depois de confirmar", async () => {
    const finishSpy = vi.fn();
    server.use(
      missionHandler(buildMissionFixture({ status: "in_progress" })),
      http.post("/api/missions/:id/finish", async ({ request }) => {
        const body = (await request.json()) as { outcome: string };
        finishSpy(body.outcome);
        return HttpResponse.json(
          buildMissionFixture({ status: "succeeded" }),
        );
      }),
    );

    const user = userEvent.setup();
    renderDialog();

    await screen.findByText("Resgate no centro");
    await user.click(
      screen.getByRole("button", { name: "Encerrar com sucesso" }),
    );

    expect(
      await screen.findByText(
        /Encerrar a missão "Resgate no centro" com sucesso\? Essa ação não pode ser desfeita\./,
      ),
    ).toBeInTheDocument();
    expect(finishSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Encerrar" }));

    await waitFor(() => {
      expect(finishSpy).toHaveBeenCalledWith("succeeded");
    });
  });

  it("encerrar com fracasso pede confirmação antes de chamar a API", async () => {
    const finishSpy = vi.fn();
    server.use(
      missionHandler(buildMissionFixture({ status: "in_progress" })),
      http.post("/api/missions/:id/finish", async ({ request }) => {
        const body = (await request.json()) as { outcome: string };
        finishSpy(body.outcome);
        return HttpResponse.json(buildMissionFixture({ status: "failed" }));
      }),
    );

    const user = userEvent.setup();
    renderDialog();

    await screen.findByText("Resgate no centro");
    await user.click(
      screen.getByRole("button", { name: "Encerrar com fracasso" }),
    );

    expect(
      await screen.findByText(
        /Encerrar a missão "Resgate no centro" com fracasso\? Essa ação não pode ser desfeita\./,
      ),
    ).toBeInTheDocument();
    expect(finishSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Encerrar" }));

    await waitFor(() => {
      expect(finishSpy).toHaveBeenCalledWith("failed");
    });
  });
});

describe("MissionDetailsDialog - heróis escalados e escalar herói", () => {
  it("mostra o X de remover só quando a missão está agendada", async () => {
    const hero = buildHeroFixture({ id: "hero-1", nickname: "Trovão" });

    server.use(
      missionHandler(
        buildMissionFixture({ status: "scheduled", heroes: [hero] }),
      ),
    );
    renderDialog();

    await screen.findByText("Trovão");
    expect(
      screen.getByRole("button", { name: "Remover Trovão da missão" }),
    ).toBeInTheDocument();
  });

  it("não mostra o X de remover quando a missão não está agendada", async () => {
    const hero = buildHeroFixture({ id: "hero-1", nickname: "Trovão" });

    server.use(
      missionHandler(
        buildMissionFixture({ status: "in_progress", heroes: [hero] }),
      ),
    );
    renderDialog();

    await screen.findByText("Trovão");
    expect(
      screen.queryByRole("button", { name: "Remover Trovão da missão" }),
    ).not.toBeInTheDocument();
  });

  it("mostra a lista de candidatos para escalar mesmo com a busca vazia", async () => {
    server.use(
      missionHandler(buildMissionFixture({ status: "scheduled", heroes: [] })),
      http.get("/api/heroes", () =>
        HttpResponse.json({
          data: [buildHeroFixture({ id: "hero-2", nickname: "Fênix Rubra" })],
          next_cursor: null,
          prev_cursor: null,
        }),
      ),
    );
    renderDialog();

    await screen.findByText("Resgate no centro");

    expect(await screen.findByText("Fênix Rubra")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Escalar/ }),
    ).toBeInTheDocument();
  });

  it("clicar em Escalar chama a API com o herói certo", async () => {
    let assignedHeroId: string | null = null;

    server.use(
      missionHandler(buildMissionFixture({ status: "scheduled", heroes: [] })),
      http.get("/api/heroes", () =>
        HttpResponse.json({
          data: [buildHeroFixture({ id: "hero-2", nickname: "Fênix Rubra" })],
          next_cursor: null,
          prev_cursor: null,
        }),
      ),
      http.post("/api/missions/:id/heroes", async ({ request }) => {
        const body = (await request.json()) as { hero_id: string };
        assignedHeroId = body.hero_id;
        return HttpResponse.json(
          buildMissionFixture({
            status: "scheduled",
            heroes: [buildHeroFixture({ id: "hero-2", nickname: "Fênix Rubra" })],
          }),
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderDialog();

    await screen.findByText("Resgate no centro");
    await user.click(await screen.findByRole("button", { name: /Escalar/ }));

    await waitFor(() => {
      expect(assignedHeroId).toBe("hero-2");
    });
  });

  it("clicar no X remove o herói escalado", async () => {
    let unassignedHeroId: string | null = null;
    const hero = buildHeroFixture({ id: "hero-1", nickname: "Trovão" });

    server.use(
      missionHandler(
        buildMissionFixture({ status: "scheduled", heroes: [hero] }),
      ),
      http.delete("/api/missions/:id/heroes/:heroId", ({ params }) => {
        unassignedHeroId = params.heroId as string;
        return HttpResponse.json(
          buildMissionFixture({ status: "scheduled", heroes: [] }),
        );
      }),
    );

    const user = userEvent.setup();
    renderDialog();

    await screen.findByText("Trovão");
    await user.click(
      screen.getByRole("button", { name: "Remover Trovão da missão" }),
    );

    await waitFor(() => {
      expect(unassignedHeroId).toBe("hero-1");
    });
  });
});
