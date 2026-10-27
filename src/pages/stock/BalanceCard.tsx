import { Building2 } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { Tile } from "@/components/ui";
import type { StockBalanceSummaryResponse } from "@/types/api";

/** Card de saldo: item, SKU, unidade e a quantidade em destaque. */
export function BalanceCard({ balance: b, onClick }: { balance: StockBalanceSummaryResponse; onClick?: () => void }) {
  return (
    <Tile onClick={onClick}>
      <div className="min-w-0">
        <h3 className="truncate font-medium text-slate-100">{b.item.name}</h3>
        <p className="font-mono text-xs text-slate-500">{b.item.sku}</p>
      </div>
      <div className="mt-auto flex items-end justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-1 text-xs text-slate-400">
          <Building2 className="size-3.5 shrink-0" />
          <span className="truncate">{b.facility?.name ?? "—"}</span>
        </span>
        <span className="text-3xl font-semibold tabular-nums text-slate-100">{formatNumber(b.quantity)}</span>
      </div>
    </Tile>
  );
}
