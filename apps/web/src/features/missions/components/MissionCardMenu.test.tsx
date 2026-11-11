import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { buildMissionFixture } from "../../../test/msw/fixtures.js";
import { server } from "../../../test/msw/server.js";
import { renderWithProviders } from "../../../test/render.js";
import { MissionCardMenu } from "./MissionCardMenu.js";

function renderMenu(
  overrides: Partial<Parameters<typeof MissionCardMenu>[0]> = {},
) {
  renderWithProviders(
    <MissionCardMenu
      missionId="mission-1"
      missionTitle="Resgate no centro"
      status="in_progress"
      assignedHeroesTotal={1}
      {...overrides}
    />,
  );
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Mais ações" }));
}

describe("MissionCardMenu - confirmação antes de cancelar/encerrar", () => {
  it("cancelar pede confirmação e só chama a API depois de confirmar", async () => {
    const cancelSpy = vi.fn();
    server.use(
      http.post("/api/missions/:id/cancel", () => {
        cancelSpy();
        return HttpResponse.json(buildMissionFixture({ status: "cancelled" }));
      }),
    );

    const user = userEvent.setup();
    renderMenu();

    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Cancelar missão" }));

    expect(
      await screen.findByText(
        /Cancelar a missão "Resgate no centro"\? Essa ação não pode ser desfeita\./,
      ),
    ).toBeInTheDocument();
    expect(cancelSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Sim, cancelar" }));

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("encerrar com sucesso pede confirmação e só chama a API depois de confirmar", async () => {
    const finishSpy = vi.fn();
    server.use(
      http.post("/api/missions/:id/finish", async ({ request }) => {
        const body = (await request.json()) as { outcome: string };
        finishSpy(body.outcome);
        return HttpResponse.json(buildMissionFixture({ status: "succeeded" }));
      }),
    );

    const user = userEvent.setup();
    renderMenu();

    await openMenu(user);
    await user.click(
      screen.getByRole("menuitem", { name: "Encerrar com sucesso" }),
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
      http.post("/api/missions/:id/finish", async ({ request }) => {
        const body = (await request.json()) as { outcome: string };
        finishSpy(body.outcome);
        return HttpResponse.json(buildMissionFixture({ status: "failed" }));
      }),
    );

    const user = userEvent.setup();
    renderMenu();

    await openMenu(user);
    await user.click(
      screen.getByRole("menuitem", { name: "Encerrar com fracasso" }),
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
