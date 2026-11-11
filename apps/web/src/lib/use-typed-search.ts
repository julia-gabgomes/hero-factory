import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { z } from "zod";

export function useTypedSearch<Schema extends z.ZodTypeAny>(
  schema: Schema,
): [z.infer<Schema>, (patch: Partial<z.infer<Schema>>) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = useMemo(() => {
    const raw = Object.fromEntries(searchParams.entries());
    const parsed = schema.safeParse(raw);
    return parsed.success ? parsed.data : schema.parse({});
  }, [searchParams, schema]);

  const setValues = useCallback(
    (patch: Partial<z.infer<Schema>>) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(patch)) {
          if (
            value === undefined ||
            value === "" ||
            (Array.isArray(value) && value.length === 0)
          ) {
            next.delete(key);
          } else if (typeof value === "string") {
            next.set(key, value);
          } else if (Array.isArray(value)) {
            next.set(key, value.join(","));
          } else {
            next.set(key, JSON.stringify(value));
          }
        }
        return next;
      });
    },
    [setSearchParams],
  );

  return [values, setValues];
}
