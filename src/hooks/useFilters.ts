import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Guarda filtros e página na URL (?page=2&status=OPEN), assim
 * dá para recarregar, voltar e compartilhar o link sem perder a busca.
 */
export function useFilters<T extends Record<string, string>>(defaults: T) {
  const [params, setParams] = useSearchParams();

  const filters = Object.fromEntries(
    Object.keys(defaults).map((k) => [k, params.get(k) ?? defaults[k]]),
  ) as T;
  const page = Number(params.get("page") ?? 0);

  const setFilter = useCallback(
    (key: keyof T, value: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(String(key), value);
          else next.delete(String(key));
          next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const setPage = useCallback(
    (p: number) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (p > 0) next.set("page", String(p));
        else next.delete("page");
        return next;
      }),
    [setParams],
  );

  const reset = useCallback(() => setParams({}, { replace: true }), [setParams]);

  return { filters, page, setFilter, setPage, reset };
}
