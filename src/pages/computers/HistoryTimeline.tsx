import { Link } from "react-router-dom";
import { Monitor } from "lucide-react";
import { formatDateTime, formatRelative } from "@/lib/format";
import { directionLabel, directionTone } from "@/lib/labels";
import { Badge, Timeline } from "@/components/ui";
import type { ComputerHistorySummaryResponse } from "@/types/api";

interface Props {
  rows: ComputerHistorySummaryResponse[] | undefined;
  loading?: boolean;
  onRowClick?: (h: ComputerHistorySummaryResponse) => void;
  /** Na página do próprio computador o nome e o link são redundantes. */
  hideComputer?: boolean;
  /** texto (vira EmptyState) ou um nó pronto */
  empty?: React.ReactNode;
}

/** Textos automáticos que o backend grava em inglês. */
const autoText: Record<string, string> = {
  Created: "Computador cadastrado",
  Updated: "Computador atualizado",
  Moved: "Computador movido",
};
const describe = (s: string) => autoText[s?.trim()] ?? s;

/** Histórico de serviços em linha do tempo (data = createdAt do registro). */
export function HistoryTimeline({ rows, loading, onRowClick, hideComputer, empty }: Props) {
  return (
    <Timeline
      rows={rows}
      loading={loading}
      rowKey={(h) => h.id}
      tone={(h) => directionTone[h.direction]}
      onRowClick={onRowClick}
      empty={empty ?? "Nenhum registro."}
      render={(h) => (
        <div className="min-w-0">
          {!hideComputer && h.computer && (
            <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
              <Link
                to={`/computers/${h.computer.id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex min-w-0 items-center gap-1.5 font-medium text-slate-100 hover:text-brand-400"
              >
                <Monitor className="size-4 shrink-0 text-slate-500" />
                <span className="truncate">{h.computer.name}</span>
              </Link>
            </div>
          )}
          <div className="flex items-start justify-between gap-4">
            <p className="min-w-0 text-sm text-slate-300">{describe(h.serviceDescription)}</p>
            <Badge tone={directionTone[h.direction]}>{directionLabel[h.direction]}</Badge>
          </div>
          {h.createdAt && (
            <time className="mt-1 block text-xs text-slate-500" dateTime={h.createdAt} title={formatDateTime(h.createdAt)}>
              {formatDateTime(h.createdAt)} · {formatRelative(h.createdAt)}
            </time>
          )}
        </div>
      )}
    />
  );
}
