import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { useTypedSearch } from "./use-typed-search.js";

const schema = z.object({
  q: z.string().optional(),
  cursor: z.string().optional(),
});

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/heroes?q=thor"]}>{children}</MemoryRouter>
  );
}

describe("useTypedSearch", () => {
  it("lê os valores iniciais da URL segundo o schema", () => {
    const { result } = renderHook(() => useTypedSearch(schema), { wrapper });

    expect(result.current[0]).toEqual({ q: "thor" });
  });

  it("adiciona um parâmetro novo na URL preservando os existentes", () => {
    const { result } = renderHook(() => useTypedSearch(schema), { wrapper });

    act(() => {
      result.current[1]({ cursor: "abc" });
    });

    expect(result.current[0]).toEqual({ q: "thor", cursor: "abc" });
  });

  it("remove um parâmetro da URL quando o valor é undefined ou vazio", () => {
    const { result } = renderHook(() => useTypedSearch(schema), { wrapper });

    act(() => {
      result.current[1]({ cursor: "abc" });
    });
    act(() => {
      result.current[1]({ q: undefined });
    });

    expect(result.current[0]).toEqual({ cursor: "abc" });
  });

  it("devolve um objeto vazio quando a URL não tem parâmetros conhecidos", () => {
    function emptyWrapper({ children }: { children: ReactNode }) {
      return (
        <MemoryRouter initialEntries={["/heroes"]}>{children}</MemoryRouter>
      );
    }

    const { result } = renderHook(() => useTypedSearch(schema), {
      wrapper: emptyWrapper,
    });

    expect(result.current[0]).toEqual({});
  });
});
