import type { StockBalanceSummaryResponse } from "@/types/api";

export type MinimumState = "below" | "at" | "ok" | "unknown";

/** Mínimo do item (aceita no saldo ou dentro do item). */
export function minimumOf(b: StockBalanceSummaryResponse): number | undefined {
  const m = b.minimum ?? b.item?.minimum;
  return m == null ? undefined : m;
}

export function minimumState(b: StockBalanceSummaryResponse): MinimumState {
  const m = minimumOf(b);
  if (m === undefined) return "unknown";
  if (b.quantity < m) return "below";
  if (b.quantity === m) return "at";
  return "ok";
}
