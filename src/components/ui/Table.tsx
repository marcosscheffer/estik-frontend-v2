import clsx from "clsx";
import { EmptyState } from "./States";

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** classe extra por linha (ex.: destacar um alerta) */
  rowClassName?: (row: T) => string | false | undefined;
  /** texto (vira EmptyState) ou um nó pronto */
  empty?: React.ReactNode;
}

export function Table<T>({ columns, rows, loading, rowKey, onRowClick, rowClassName, empty }: TableProps<T>) {
  if (loading && !rows) {
    // esqueleto: mesmas colunas, linhas cinzas pulsando
    return (
      <div className="divide-y divide-slate-800/70" aria-busy="true" aria-label="Carregando">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-6 px-4 py-3.5">
            {columns.map((c, j) => (
              <span key={c.header} className={clsx("h-4 animate-pulse rounded bg-slate-800", j === 0 ? "w-48" : "w-20")} />
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (!rows?.length) return typeof empty === "string" || !empty ? <EmptyState message={(empty as string) ?? "Nada encontrado."} /> : <>{empty}</>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-800 text-sm">
        <thead className="bg-slate-800/40">
          <tr>
            {columns.map((c) => (
              <th
                key={c.header}
                className={clsx(
                  "px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500",
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={clsx("divide-y divide-slate-800/70 bg-slate-900", loading && "opacity-60")}>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={clsx(onRowClick && "cursor-pointer transition-colors hover:bg-slate-800/60", rowClassName?.(row))}
            >
              {columns.map((c) => (
                <td key={c.header} className={clsx("whitespace-nowrap px-4 py-3 text-slate-300", c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
