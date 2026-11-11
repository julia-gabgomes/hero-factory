import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { missionStatusListSchema } from "@hero-factory/shared";
import { useTypedSearch } from "./use-typed-search.js";

const schema = z.object({
  q: z.string().optional(),
  cursor: z.string().optional(),
});

const schemaWithStatus = z.object({
  cursor: z.string().optional(),
  status: missionStatusListSchema,
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

  it("escreve um array como CSV na URL e lê de volta com o schema real do shared", () => {
    function statusWrapper({ children }: { children: ReactNode }) {
      return <MemoryRouter initialEntries={["/missions"]}>{children}</MemoryRouter>;
    }

    const { result } = renderHook(() => useTypedSearch(schemaWithStatus), {
      wrapper: statusWrapper,
    });

    act(() => {
      result.current[1]({ status: ["scheduled", "failed"] });
    });

    expect(result.current[0].status).toEqual(["scheduled", "failed"]);
  });

  it("remove o parâmetro status da URL quando o array fica vazio", () => {
    function statusWrapper({ children }: { children: ReactNode }) {
      return (
        <MemoryRouter initialEntries={["/missions?status=scheduled"]}>
          {children}
        </MemoryRouter>
      );
    }

    const { result } = renderHook(() => useTypedSearch(schemaWithStatus), {
      wrapper: statusWrapper,
    });

    expect(result.current[0].status).toEqual(["scheduled"]);

    act(() => {
      result.current[1]({ status: [] });
    });

    expect(result.current[0].status).toBeUndefined();
  });

  it("lê um status já presente na URL (deep-link)", () => {
    function statusWrapper({ children }: { children: ReactNode }) {
      return (
        <MemoryRouter initialEntries={["/missions?status=failed"]}>
          {children}
        </MemoryRouter>
      );
    }

    const { result } = renderHook(() => useTypedSearch(schemaWithStatus), {
      wrapper: statusWrapper,
    });

    expect(result.current[0].status).toEqual(["failed"]);
  });
});
