import {
  ArrowDownToLine,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpFromLine,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import clsx from "clsx";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { movementLabel, movementTone } from "@/lib/labels";
import { Badge, Timeline } from "@/components/ui";
import type { MovementType, RefSummary, StockMovementSummaryResponse } from "@/types/api";

interface Place {
  facility?: RefSummary | null;
  departament?: RefSummary | null;
}

const typeStyle: Record<MovementType, { icon: React.ComponentType<{ className?: string }>; box: string; qty: string; sign: string }> = {
  IN: { icon: ArrowDownToLine, box: "bg-emerald-500/15 text-emerald-400", qty: "text-emerald-400", sign: "+" },
  OUT: { icon: ArrowUpFromLine, box: "bg-red-500/15 text-red-400", qty: "text-red-400", sign: "−" },
  TRANSFER: { icon: ArrowRightLeft, box: "bg-violet-500/15 text-violet-400", qty: "text-slate-200", sign: "" },
  ADJUSTMENT: { icon: SlidersHorizontal, box: "bg-amber-500/15 text-amber-400", qty: "text-amber-400", sign: "±" },
};

/** "Unidade › Departamento" em texto corrido. */
function PlaceText({ place }: { place: Place }) {
  return (
    <span className="font-medium text-slate-200">
      {place.facility?.name ?? "—"}
      <ChevronRight className="mx-0.5 inline size-3 text-slate-500" />
      {place.departament?.name ?? "—"}
    </span>
  );
}

/** Bloco de origem/destino da transferência. */
function PlaceChip({ label, place, current }: { label: string; place: Place; current: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex min-w-0 max-w-full flex-col rounded-lg px-2.5 py-1.5 ring-1",
        current ? "bg-brand-500/10 ring-brand-500/40" : "bg-slate-800/60 ring-slate-700/60",
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {current && <span className="ml-1 normal-case tracking-normal text-brand-400">· deste departamento</span>}
      </span>
      <span className="truncate text-xs text-slate-200">{place.facility?.name ?? "—"}</span>
      <span className="truncate text-xs text-slate-400">{place.departament?.name ?? "—"}</span>
    </span>
  );
}

function Description({ m, currentDepartamentId }: { m: StockMovementSummaryResponse; currentDepartamentId?: string }) {
  const from: Place = { facility: m.facilitySource, departament: m.departamentSource };
  const to: Place = { facility: m.facilityDestination, departament: m.departamentDestination };
  const qty = `${formatNumber(m.quantity)} un.`;

  if (m.type === "TRANSFER") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <PlaceChip label="Origem" place={from} current={!!currentDepartamentId && from.departament?.id === currentDepartamentId} />
        <ArrowRight className="size-4 shrink-0 text-slate-500" />
        <PlaceChip label="Destino" place={to} current={!!currentDepartamentId && to.departament?.id === currentDepartamentId} />
      </div>
    );
  }

  // entrada usa o destino; saída usa a origem; ajuste usa o que vier
  const place = m.type === "IN" ? to : m.type === "OUT" ? from : to.facility ? to : from;
  const text = {
    IN: <>Entrada de {qty} em </>,
    OUT: <>Saída de {qty} de </>,
    ADJUSTMENT: <>Ajuste de estoque em </>,
  }[m.type];
  return (
    <p className="text-sm text-slate-400">
      {text}
      <PlaceText place={place} />
    </p>
  );
}

interface Props {
  rows: StockMovementSummaryResponse[] | undefined;
  loading?: boolean;
  onRowClick?: (m: StockMovementSummaryResponse) => void;
  /** Na aba do departamento: destaca o lado (origem/destino) que é ele. */
  currentDepartamentId?: string;
}

/** Movimentações com origem/destino (unidade + departamento) explícitos em cada linha. */
export function MovementTimeline({ rows, loading, onRowClick, currentDepartamentId }: Props) {
  return (
    <Timeline
      rows={rows}
      loading={loading}
      rowKey={(x) => x.id}
      tone={(x) => movementTone[x.type]}
      onRowClick={onRowClick}
      empty="Nenhuma movimentação."
      render={(m) => {
        const style = typeStyle[m.type];
        const Icon = style.icon;

        return (
          <div className="flex items-start gap-3">
            <span className={clsx("flex size-10 shrink-0 items-center justify-center rounded-lg", style.box)}>
              <Icon className="size-5" />
            </span>

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={movementTone[m.type]}>{movementLabel[m.type]}</Badge>
                <span className="font-medium text-slate-100">{m.item?.name}</span>
                {m.item?.sku && <span className="font-mono text-xs text-slate-500">{m.item.sku}</span>}
              </div>
              <Description m={m} currentDepartamentId={currentDepartamentId} />
            </div>

            <div className="shrink-0 text-right">
              <p className={clsx("text-lg font-semibold tabular-nums", style.qty)}>
                {style.sign}
                {formatNumber(m.quantity)}
              </p>
              <time className="text-xs text-slate-500" dateTime={m.createdAt} title={formatDateTime(m.createdAt)}>
                {formatRelative(m.createdAt)}
              </time>
            </div>
          </div>
        );
      }}
    />
  );
}
