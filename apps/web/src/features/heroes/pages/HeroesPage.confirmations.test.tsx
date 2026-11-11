import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { buildHeroFixture } from "../../../test/msw/fixtures.js";
import { server } from "../../../test/msw/server.js";
import { renderWithProviders } from "../../../test/render.js";
import { HeroesPage } from "./HeroesPage.js";

describe("HeroesPage - confirmação antes de excluir/inativar/ativar", () => {
  it("excluir pede confirmação e só chama a API depois de confirmar", async () => {
    const deleteSpy = vi.fn();
    server.use(
      http.delete("/api/heroes/:id", () => {
        deleteSpy();
        return HttpResponse.json(
          buildHeroFixture({ deleted_at: "2024-05-02T00:00:00.000Z" }),
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<HeroesPage />, { initialEntries: ["/heroes"] });

    await screen.findByText("Super-Homem");
    await user.click(screen.getByRole("button", { name: "Mais ações" }));
    await user.click(screen.getByRole("menuitem", { name: "Excluir herói" }));

    expect(
      await screen.findByText(
        /Excluir Super-Homem\? Essa ação não pode ser desfeita\./,
      ),
    ).toBeInTheDocument();
    expect(deleteSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(deleteSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Mais ações" }));
    await user.click(screen.getByRole("menuitem", { name: "Excluir herói" }));
    await user.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("inativar pede confirmação com o aviso por extenso e só chama a API depois de confirmar", async () => {
    const deactivateSpy = vi.fn();
    server.use(
      http.post("/api/heroes/:id/deactivate", () => {
        deactivateSpy();
        return HttpResponse.json(buildHeroFixture({ is_active: false }));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<HeroesPage />, { initialEntries: ["/heroes"] });

    await screen.findByText("Super-Homem");
    await user.click(screen.getByRole("button", { name: "Mais ações" }));
    await user.click(screen.getByRole("switch", { name: "Inativar herói" }));

    expect(
      await screen.findByText(
        /Inativar Super-Homem\? Ele não poderá ser escalado em missões\./,
      ),
    ).toBeInTheDocument();
    expect(deactivateSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Inativar" }));

    await waitFor(() => {
      expect(deactivateSpy).toHaveBeenCalledTimes(1);
    });
  });
});
