import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dateTimeLocalToIsoUtc,
  formatDateOfBirth,
  isoUtcToDateTimeLocal,
  todayAsDateInputValue,
} from "./dates.js";

describe("formatDateOfBirth", () => {
  it("formata YYYY-MM-DD para DD/MM/AAAA sem usar Date", () => {
    expect(formatDateOfBirth("1990-06-18")).toBe("18/06/1990");
  });

  it("não desloca o dia em datas no início ou fim do mês/ano", () => {
    expect(formatDateOfBirth("2024-01-01")).toBe("01/01/2024");
    expect(formatDateOfBirth("2024-12-31")).toBe("31/12/2024");
    expect(formatDateOfBirth("2024-02-29")).toBe("29/02/2024");
  });
});

describe("todayAsDateInputValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devolve a data local de hoje no formato YYYY-MM-DD", () => {
    vi.setSystemTime(new Date(2024, 4, 1, 23, 0, 0));

    expect(todayAsDateInputValue()).toBe("2024-05-01");
  });
});

describe("dateTimeLocalToIsoUtc / isoUtcToDateTimeLocal", () => {
  it("faz o caminho de ida e volta sem perder o horário local", () => {
    const localValue = "2024-05-01T10:30";

    const iso = dateTimeLocalToIsoUtc(localValue);
    const backToLocal = isoUtcToDateTimeLocal(iso);

    expect(backToLocal).toBe(localValue);
  });

  it("converte para uma string ISO UTC terminada em Z", () => {
    const iso = dateTimeLocalToIsoUtc("2024-05-01T10:30");

    expect(iso).toMatch(/Z$/);
  });
});
