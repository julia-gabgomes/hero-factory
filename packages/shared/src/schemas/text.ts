import { z } from "zod";

export function codePointLength(value: string): number {
  return Array.from(value).length;
}

export function requiredText(max: number) {
  return z
    .string()
    .trim()
    .min(1, { message: "Campo obrigatório." })
    .refine((value) => codePointLength(value) <= max, {
      message: `Deve ter no máximo ${String(max)} caracteres.`,
    });
}
