import clsx from "clsx";
import { Loader2 } from "lucide-react";
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
  empty?: string;
}

export function Table<T>({ columns, rows, loading, rowKey, onRowClick, empty }: TableProps<T>) {
  if (loading && !rows) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!rows?.length) return <EmptyState message={empty ?? "Nada encontrado."} />;

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
              className={clsx(onRowClick && "cursor-pointer hover:bg-slate-800/60")}
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
