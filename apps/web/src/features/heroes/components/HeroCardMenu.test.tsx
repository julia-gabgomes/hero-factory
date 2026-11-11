import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { buildHeroFixture } from "../../../test/msw/fixtures.js";
import { renderWithProviders } from "../../../test/render.js";
import { HeroCardMenu } from "./HeroCardMenu.js";

describe("HeroCardMenu", () => {
  it("herói ativo mostra excluir, editar e o switch ligado", async () => {
    const user = userEvent.setup();
    const hero = buildHeroFixture({ is_active: true });

    renderWithProviders(
      <HeroCardMenu
        hero={hero}
        onEdit={vi.fn()}
        onRequestDelete={vi.fn()}
        onRequestToggleActive={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mais ações" }));

    expect(
      screen.getByRole("menuitem", { name: "Excluir herói" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Editar herói" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Inativar herói" }),
    ).toBeChecked();
  });

  it("herói inativo mostra só excluir, o switch desligado, e nenhum editar", async () => {
    const user = userEvent.setup();
    const hero = buildHeroFixture({ is_active: false });

    renderWithProviders(
      <HeroCardMenu
        hero={hero}
        onEdit={vi.fn()}
        onRequestDelete={vi.fn()}
        onRequestToggleActive={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mais ações" }));

    expect(
      screen.getByRole("menuitem", { name: "Excluir herói" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Editar herói" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Ativar herói" }),
    ).not.toBeChecked();
  });

  it("clicar em excluir chama onRequestDelete", async () => {
    const user = userEvent.setup();
    const onRequestDelete = vi.fn();
    const hero = buildHeroFixture({ is_active: true });

    renderWithProviders(
      <HeroCardMenu
        hero={hero}
        onEdit={vi.fn()}
        onRequestDelete={onRequestDelete}
        onRequestToggleActive={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mais ações" }));
    await user.click(screen.getByRole("menuitem", { name: "Excluir herói" }));

    expect(onRequestDelete).toHaveBeenCalledTimes(1);
  });

  it("clicar no switch chama onRequestToggleActive (abre confirmação, não alterna na hora)", async () => {
    const user = userEvent.setup();
    const onRequestToggleActive = vi.fn();
    const hero = buildHeroFixture({ is_active: true });

    renderWithProviders(
      <HeroCardMenu
        hero={hero}
        onEdit={vi.fn()}
        onRequestDelete={vi.fn()}
        onRequestToggleActive={onRequestToggleActive}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mais ações" }));
    await user.click(screen.getByRole("switch", { name: "Inativar herói" }));

    expect(onRequestToggleActive).toHaveBeenCalledTimes(1);
  });
});
