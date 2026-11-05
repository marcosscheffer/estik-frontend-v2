import clsx from "clsx";
import { Loader2 } from "lucide-react";
import type { Tone } from "@/lib/labels";
import { EmptyState } from "./States";

const dots: Record<Tone, string> = {
  gray: "bg-slate-500 ring-slate-500/20",
  blue: "bg-blue-500 ring-blue-500/20",
  green: "bg-emerald-500 ring-emerald-500/20",
  amber: "bg-amber-500 ring-amber-500/20",
  red: "bg-red-500 ring-red-500/20",
  violet: "bg-violet-500 ring-violet-500/20",
};

interface TimelineProps<T> {
  rows: T[] | undefined;
  loading?: boolean;
  rowKey: (row: T) => string;
  tone: (row: T) => Tone;
  render: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  /** texto (vira EmptyState) ou um nó pronto */
  empty?: React.ReactNode;
}

/** Linha do tempo vertical: bolinha colorida + conteúdo, ligadas por uma linha. */
export function Timeline<T>({ rows, loading, rowKey, tone, render, onRowClick, empty }: TimelineProps<T>) {
  if (loading && !rows) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!rows?.length) return typeof empty === "string" || !empty ? <EmptyState message={(empty as string) ?? "Nada encontrado."} /> : <>{empty}</>;

  return (
    <ol className={clsx("px-4 py-5 sm:px-6", loading && "opacity-60")}>
      {rows.map((row, i) => (
        <li key={rowKey(row)} className="relative flex gap-4 pb-5 last:pb-0">
          {i < rows.length - 1 && <span className="absolute top-4 bottom-0 left-[5px] w-px bg-slate-800" aria-hidden />}
          <span className={clsx("relative mt-1.5 size-3 shrink-0 rounded-full ring-4", dots[tone(row)])} aria-hidden />
          <div
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={clsx(
              "-mt-1 min-w-0 flex-1 rounded-lg px-3 py-2",
              onRowClick && "cursor-pointer transition-colors hover:bg-slate-800/50",
            )}
          >
            {render(row)}
          </div>
        </li>
      ))}
    </ol>
  );
}
