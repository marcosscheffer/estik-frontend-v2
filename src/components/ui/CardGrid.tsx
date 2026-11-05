import clsx from "clsx";
import { EmptyState } from "./States";

interface CardGridProps<T> {
  rows: T[] | undefined;
  loading?: boolean;
  rowKey: (row: T) => string;
  renderCard: (row: T) => React.ReactNode;
  /** texto (vira EmptyState) ou um nó pronto */
  empty?: React.ReactNode;
  /** Colunas mais estreitas para cards compactos (unidades, categorias...). */
  compact?: boolean;
  className?: string;
}

/** Mesmo contrato do <Table>, mas desenha um card por registro. */
export function CardGrid<T>({ rows, loading, rowKey, renderCard, empty, compact, className }: CardGridProps<T>) {
  if (loading && !rows) {
    return (
      <div className={clsx("grid gap-4 p-4 sm:grid-cols-2", compact ? "lg:grid-cols-4" : "xl:grid-cols-3", className)} aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-800/60" />
        ))}
      </div>
    );
  }
  if (!rows?.length) return typeof empty === "string" || !empty ? <EmptyState message={(empty as string) ?? "Nada encontrado."} /> : <>{empty}</>;

  return (
    <div
      className={clsx(
        "grid gap-4 p-4 sm:grid-cols-2",
        compact ? "lg:grid-cols-3 xl:grid-cols-4" : "xl:grid-cols-3",
        loading && "opacity-60",
        className,
      )}
    >
      {rows.map((row) => (
        <div key={rowKey(row)} className="min-w-0">
          {renderCard(row)}
        </div>
      ))}
    </div>
  );
}

/** Card de um registro dentro do CardGrid. Com onClick vira botão. */
export function Tile({
  onClick,
  className,
  children,
}: {
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const base = clsx(
    "flex h-full w-full flex-col gap-3 rounded-xl bg-slate-800/50 p-4 text-left ring-1 ring-white/[0.06] transition",
    onClick && "cursor-pointer hover:-translate-y-0.5 hover:bg-slate-800/70 hover:ring-white/15",
    className,
  );
  if (!onClick) return <div className={base}>{children}</div>;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={clsx(base, "focus-visible:outline-2 focus-visible:outline-brand-600")}
    >
      {children}
    </div>
  );
}

/** Quadrado com ícone usado no topo dos cards. */
export function TileIcon({ icon: Icon, className }: { icon: React.ComponentType<{ className?: string }>; className?: string }) {
  return (
    <span className={clsx("flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-400", className)}>
      <Icon className="size-5" />
    </span>
  );
}
