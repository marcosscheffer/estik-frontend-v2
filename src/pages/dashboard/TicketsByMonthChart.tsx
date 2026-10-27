import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table2, BarChart3 } from "lucide-react";
import clsx from "clsx";
import { ticketsService } from "@/services/tickets";
import { formatNumber } from "@/lib/format";
import { Card, CardHeader, EmptyState, ErrorState } from "@/components/ui";
import type { TicketStatus, TicketSummaryResponse } from "@/types/api";

const MONTHS = 6;
const PAGE_SIZE = 100; // máximo da API
const MAX_PAGES = 10; // até 1000 chamados; acima disso o gráfico avisa que está parcial
const HEIGHT = 280;

// Mesmos matizes dos badges de status, um passo mais escuro onde precisou para
// passar no validador de paleta sobre o fundo escuro (slate-900).
const series = [
  { status: "OPEN", label: "Aberto", color: "#3b82f6" },
  { status: "PROGRESS", label: "Em andamento", color: "#d97706" },
  { status: "RESOLVED", label: "Resolvido", color: "#059669" },
] as const satisfies readonly { status: TicketStatus; label: string; color: string }[];

type Counts = Record<(typeof series)[number]["status"], number>;
interface MonthRow extends Counts {
  key: string;
  label: string;
}

const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

function lastMonths(): MonthRow[] {
  const now = new Date();
  return Array.from({ length: MONTHS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1 - i), 1);
    const name = monthFmt.format(d).replace(".", "");
    return { key: monthKey(d), label: `${name}/${String(d.getFullYear()).slice(2)}`, OPEN: 0, PROGRESS: 0, RESOLVED: 0 };
  });
}

/** A API não tem filtro de data nem endpoint de estatística: busca as páginas e agrupa aqui. */
async function fetchTickets() {
  const items: TicketSummaryResponse[] = [];
  let page = 0;
  let totalPages = 1;
  while (page < totalPages && page < MAX_PAGES) {
    const res = await ticketsService.list({ page, size: PAGE_SIZE });
    items.push(...res.items);
    totalPages = res.totalPages;
    page++;
  }
  return { items, partial: totalPages > MAX_PAGES };
}

function niceMax(value: number) {
  if (value <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(value)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step * 4 >= value) return m * step * 4;
  return value;
}

/** Barra com o topo arredondado (4px) e a base reta, apoiada no eixo. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function Chart({ rows }: { rows: MonthRow[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const margin = { top: 12, right: 8, bottom: 28, left: 36 };
  const plotW = Math.max(0, width - margin.left - margin.right);
  const plotH = HEIGHT - margin.top - margin.bottom;
  const max = niceMax(Math.max(...rows.flatMap((r) => series.map((s) => r[s.status]))));
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);
  const band = plotW / rows.length;
  const gap = 2;
  const barW = Math.min(20, (band * 0.7 - gap * (series.length - 1)) / series.length);
  const groupW = barW * series.length + gap * (series.length - 1);
  const y = (v: number) => margin.top + plotH - (v / max) * plotH;

  const hovered = hover != null ? rows[hover] : null;
  const tipLeft = hover != null ? margin.left + band * hover + band / 2 : 0;

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      <svg width={width} height={HEIGHT} role="img" aria-label="Chamados por mês e status">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={margin.left} x2={width - margin.right} y1={y(t)} y2={y(t)} stroke="#1e293b" />
            <text x={margin.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[11px] tabular-nums">
              {formatNumber(t)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const x0 = margin.left + band * i + (band - groupW) / 2;
          return (
            <g key={r.key}>
              {hover === i && (
                <rect x={margin.left + band * i} y={margin.top} width={band} height={plotH} className="fill-slate-800/40" />
              )}
              {series.map((s, j) => {
                const v = r[s.status];
                if (!v) return null;
                const h = Math.max(1, plotH - (y(v) - margin.top));
                return <path key={s.status} d={barPath(x0 + j * (barW + gap), y(v), barW, h)} fill={s.color} />;
              })}
              <text
                x={margin.left + band * i + band / 2}
                y={HEIGHT - 8}
                textAnchor="middle"
                className={clsx("text-[11px]", hover === i ? "fill-slate-200" : "fill-slate-500")}
              >
                {r.label}
              </text>
              {/* área de hover maior que as barras */}
              <rect
                x={margin.left + band * i}
                y={margin.top}
                width={band}
                height={plotH + margin.bottom}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          );
        })}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-44 -translate-x-1/2 rounded-lg bg-slate-950/95 p-3 text-xs shadow-lg ring-1 ring-slate-700"
          style={{ left: Math.min(Math.max(tipLeft, 90), width - 90) }}
        >
          <p className="mb-1.5 font-semibold text-slate-100">{hovered.label}</p>
          {series.map((s) => (
            <p key={s.status} className="flex items-center justify-between gap-3 text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="tabular-nums text-slate-100">{formatNumber(hovered[s.status])}</span>
            </p>
          ))}
          <p className="mt-1.5 flex justify-between border-t border-slate-800 pt-1.5 text-slate-400">
            Total
            <span className="tabular-nums text-slate-100">
              {formatNumber(series.reduce((sum, s) => sum + hovered[s.status], 0))}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

function DataTable({ rows }: { rows: MonthRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4 font-semibold">Mês</th>
            {series.map((s) => <th key={s.status} className="py-2 pr-4 text-right font-semibold">{s.label}</th>)}
            <th className="py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70 text-slate-300">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="py-2 pr-4">{r.label}</td>
              {series.map((s) => <td key={s.status} className="py-2 pr-4 text-right tabular-nums">{formatNumber(r[s.status])}</td>)}
              <td className="py-2 text-right tabular-nums text-slate-100">{formatNumber(series.reduce((sum, s) => sum + r[s.status], 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TicketsByMonthChart() {
  const [asTable, setAsTable] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["tickets", "by-month"],
    queryFn: fetchTickets,
    staleTime: 60_000,
  });

  const rows = useMemo(() => {
    const months = lastMonths();
    const byKey = new Map(months.map((m) => [m.key, m]));
    for (const t of data?.items ?? []) {
      const row = byKey.get(monthKey(new Date(t.createdAt)));
      if (row && t.status in row && t.status !== "CANCELLED") row[t.status as keyof Counts]++;
    }
    return months;
  }, [data]);

  const empty = rows.every((r) => series.every((s) => !r[s.status]));

  return (
    <Card>
      <CardHeader
        title="Chamados por mês"
        description="Chamados abertos em cada mês, pelo status atual (últimos 6 meses)."
        actions={
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            {asTable ? <BarChart3 className="size-3.5" /> : <Table2 className="size-3.5" />}
            {asTable ? "Ver gráfico" : "Ver tabela"}
          </button>
        }
      />
      <div className="px-5 py-4">
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
          {series.map((s) => (
            <span key={s.status} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        {error ? (
          <ErrorState error={error} />
        ) : isLoading ? (
          <div className="h-[280px] animate-pulse rounded-lg bg-slate-800/40" />
        ) : empty ? (
          <EmptyState message="Nenhum chamado no período." />
        ) : asTable ? (
          <DataTable rows={rows} />
        ) : (
          <Chart rows={rows} />
        )}
        {data?.partial && (
          <p className="mt-2 text-xs text-slate-500">Mostrando só os primeiros {MAX_PAGES * PAGE_SIZE} chamados; o gráfico pode estar incompleto.</p>
        )}
      </div>
    </Card>
  );
}
