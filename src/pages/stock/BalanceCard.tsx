import { AlertTriangle, Building2 } from "lucide-react";
import clsx from "clsx";
import { minimumOf, minimumState } from "@/lib/stock";
import { formatNumber } from "@/lib/format";
import { Tile } from "@/components/ui";
import type { StockBalanceSummaryResponse } from "@/types/api";

/** Card de saldo: item, SKU, unidade e a quantidade em destaque (com rótulo "un."). */
export function BalanceCard({ balance: b, onClick }: { balance: StockBalanceSummaryResponse; onClick?: () => void }) {
  const min = minimumOf(b);
  const state = minimumState(b);
  return (
    <Tile
      onClick={onClick}
      className={clsx(
        // abaixo do mínimo: borda vermelha bem visível; no mínimo: âmbar
        state === "below" && "border-2 border-red-500 bg-red-950/40",
        state === "at" && "border-2 border-amber-500",
      )}
    >
      <MinimumTag state={state} />
      <div className="min-w-0">
        <h3 className="truncate font-medium text-slate-100">{b.item.name}</h3>
        <p className="mt-0.5 font-mono text-xs text-slate-500">SKU {b.item.sku}</p>
      </div>
      <div className="mt-auto flex items-end justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-1 text-xs text-slate-400">
          <Building2 className="size-3.5 shrink-0" />
          <span className="truncate">{b.facility?.name ?? "—"}</span>
        </span>
        <span className="text-right">
          <span className={clsx("block text-3xl font-semibold leading-none tabular-nums", state === "below" ? "text-red-300" : "text-slate-100")}>
            {formatNumber(b.quantity)}
          </span>
          <span className="text-[11px] text-slate-500">
            em estoque{min !== undefined && <> · mín. {formatNumber(min)}</>}
          </span>
        </span>
      </div>
    </Tile>
  );
}

/** Aviso de estoque mínimo: sólido quando abaixo, discreto quando no limite. */
export function MinimumTag({ state, showOk }: { state: ReturnType<typeof minimumState>; showOk?: boolean }) {
  if (state === "below")
    return (
      <span className="inline-flex w-fit items-center gap-1 rounded-md bg-red-950 px-2 py-0.5 text-xs font-semibold text-red-200 ring-1 ring-inset ring-red-800">
        <AlertTriangle className="size-3.5" /> Abaixo do mínimo
      </span>
    );
  if (state === "at")
    return (
      <span className="inline-flex w-fit items-center rounded-md bg-amber-950 px-2 py-0.5 text-xs font-medium text-amber-200 ring-1 ring-inset ring-amber-800">
        No mínimo
      </span>
    );
  if (state === "ok" && showOk) return <span className="text-xs text-emerald-400">Normal</span>;
  return null;
}
