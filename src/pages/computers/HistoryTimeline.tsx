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
  empty?: string;
}

/**
 * Histórico de serviços em linha do tempo. O resumo da API não traz a data do
 * registro (ela fica no detalhe); o updatedAt que vem é o do computador.
 */
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
              {h.computer.updatedAt && (
                <time
                  className="shrink-0 text-xs text-slate-500"
                  dateTime={h.computer.updatedAt}
                  title={formatDateTime(h.computer.updatedAt)}
                >
                  computador atualizado {formatRelative(h.computer.updatedAt)}
                </time>
              )}
            </div>
          )}
          <div className="flex items-start justify-between gap-4">
            <p className="min-w-0 text-sm text-slate-300">{h.serviceDescription}</p>
            <Badge tone={directionTone[h.direction]}>{directionLabel[h.direction]}</Badge>
          </div>
        </div>
      )}
    />
  );
}
