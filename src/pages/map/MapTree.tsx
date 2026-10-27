import { createContext, useContext } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Building2, ChevronRight, Loader2, Monitor, Network, Package } from "lucide-react";
import clsx from "clsx";
import { mapQueries } from "@/hooks/useMapQueries";
import { formatNumber } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import type {
  ComputerSummaryResponse,
  DepartamentSummaryResponse,
  FacilitySummaryResponse,
  StockBalanceSummaryResponse,
} from "@/types/api";

/* ---------------- estado compartilhado ---------------- */

export type NodeType = "f" | "d" | "c" | "b";
export const nodeKey = (type: NodeType, id: string) => `${type}:${id}`;

interface MapState {
  query: string;
  isOpen: (key: string) => boolean;
  toggle: (key: string) => void;
  open: (key: string) => void;
  selected: string | null;
  select: (key: string) => void;
}
export const MapContext = createContext<MapState | null>(null);
const useMap = () => useContext(MapContext)!;

export const matches = (text: string | undefined, q: string) => !!text && text.toLowerCase().includes(q);

/* ---------------- visual por tipo ---------------- */

export const nodeStyle = {
  f: { icon: Building2, color: "text-sky-400", bg: "bg-sky-500/15" },
  d: { icon: Network, color: "text-violet-400", bg: "bg-violet-500/15" },
  c: { icon: Monitor, color: "text-brand-400", bg: "bg-brand-500/15" },
  b: { icon: Package, color: "text-emerald-400", bg: "bg-emerald-500/15" },
} as const;

function Highlight({ text }: { text: string }) {
  const { query } = useMap();
  const i = query ? text.toLowerCase().indexOf(query) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-amber-400/25 px-0.5 text-amber-100">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

function Count({ value, label }: { value?: number; label: string }) {
  if (value == null) return null;
  return (
    <span title={label} className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-400">
      {formatNumber(value)} {label}
    </span>
  );
}

function NodeRow({
  nodeId,
  type,
  label,
  expandable,
  expanded,
  loading,
  badges,
  trailing,
}: {
  nodeId: string;
  type: NodeType;
  label: string;
  expandable?: boolean;
  expanded?: boolean;
  loading?: boolean;
  badges?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  const { selected, select, toggle, open } = useMap();
  const key = nodeKey(type, nodeId);
  const { icon: Icon, color } = nodeStyle[type];
  const isSelected = selected === key;

  return (
    <div
      role="treeitem"
      aria-expanded={expandable ? expanded : undefined}
      aria-selected={isSelected}
      tabIndex={0}
      onClick={() => {
        select(key);
        if (expandable && !expanded) open(key);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") select(key);
        if (expandable && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
          if ((e.key === "ArrowRight") !== !!expanded) toggle(key);
        }
      }}
      className={clsx(
        "group flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-sm transition-colors",
        "focus-visible:outline-2 focus-visible:outline-brand-600",
        isSelected ? "bg-slate-800 text-slate-100 ring-1 ring-inset ring-slate-700" : "text-slate-300 hover:bg-slate-800/50",
      )}
    >
      {expandable ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={expanded ? "Recolher" : "Expandir"}
          onClick={(e) => {
            e.stopPropagation();
            toggle(key);
          }}
          className="flex size-5 shrink-0 items-center justify-center rounded text-slate-500 hover:text-slate-200"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ChevronRight className={clsx("size-4 transition-transform", expanded && "rotate-90")} />
          )}
        </button>
      ) : (
        <span className="size-5 shrink-0" />
      )}
      <Icon className={clsx("size-4 shrink-0", color)} />
      <span className="min-w-0 flex-1 truncate">
        <Highlight text={label} />
      </span>
      {badges && <span className="hidden shrink-0 items-center gap-1 sm:flex">{badges}</span>}
      {trailing}
    </div>
  );
}

/** Filhos indentados com a linha-guia vertical. */
function Branch({ children }: { children: React.ReactNode }) {
  return <div role="group" className="ml-[17px] border-l border-slate-800 pl-2">{children}</div>;
}

function Note({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <p className={clsx("flex items-center gap-1.5 px-2 py-1.5 text-xs", error ? "text-red-400" : "text-slate-500")}>
      {error && <AlertTriangle className="size-3.5" />}
      {children}
    </p>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-2 pt-2 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{children}</p>;
}

/* ---------------- busca ---------------- */

/** O que de um departamento bate com a busca, usando só o que já está em cache. */
function departamentHits(
  d: DepartamentSummaryResponse,
  q: string,
  computers?: ComputerSummaryResponse[],
  balances?: StockBalanceSummaryResponse[],
) {
  if (!q) return { visible: true, self: true, computers, balances };
  const self = matches(d.name, q) || matches(d.code, q);
  const c = computers?.filter((x) => matches(x.name, q));
  const b = balances?.filter((x) => matches(x.item.name, q) || matches(x.item.sku, q));
  return {
    visible: self || !!c?.length || !!b?.length,
    self,
    // se o próprio departamento bateu, mostra tudo dele
    computers: self ? computers : c,
    balances: self ? balances : b,
  };
}

/* ---------------- nós ---------------- */

function DepartamentNode({ dep, parentMatched }: { dep: DepartamentSummaryResponse; parentMatched: boolean }) {
  const { query, isOpen } = useMap();
  const key = nodeKey("d", dep.id);
  const userOpen = isOpen(key);

  // enabled:false só lê o cache; a requisição sai quando o nó abre
  const computers = useQuery({ ...mapQueries.computers(dep.id), enabled: userOpen });
  const balances = useQuery({ ...mapQueries.balances(dep.id), enabled: userOpen });
  const computerCount = useQuery(mapQueries.computerCount(dep.id));
  const balanceCount = useQuery(mapQueries.balanceCount(dep.id));

  const hits = departamentHits(dep, query, computers.data?.items, balances.data?.items);
  if (query && !parentMatched && !hits.visible) return null;

  // na busca, abre (só visualmente) quem tem filho que bateu
  const searchOpen = !!query && !hits.self && (!!hits.computers?.length || !!hits.balances?.length);
  const expanded = userOpen || searchOpen;
  const loading = userOpen && (computers.isLoading || balances.isLoading);
  const showAll = !query || hits.self || parentMatched;
  const shownComputers = showAll ? computers.data?.items : hits.computers;
  const shownBalances = showAll ? balances.data?.items : hits.balances;

  return (
    <div>
      <NodeRow
        nodeId={dep.id}
        type="d"
        label={dep.name}
        expandable
        expanded={expanded}
        loading={loading}
        badges={
          <>
            <Count value={computerCount.data?.totalItems ?? computers.data?.totalItems} label="pc" />
            <Count value={balanceCount.data?.totalItems ?? balances.data?.totalItems} label="itens" />
          </>
        }
      />
      {expanded && !loading && (
        <Branch>
          <GroupLabel>Computadores</GroupLabel>
          {computers.error ? (
            <Note error>{getErrorMessage(computers.error)}</Note>
          ) : !shownComputers?.length ? (
            <Note>{query && !showAll ? "Nada encontrado aqui" : "Nenhum computador"}</Note>
          ) : (
            shownComputers.map((c) => <NodeRow key={c.id} nodeId={c.id} type="c" label={c.name} />)
          )}
          {computers.data && computers.data.totalPages > 1 && <Note>Mostrando os primeiros 100.</Note>}

          <GroupLabel>Estoque</GroupLabel>
          {balances.error ? (
            <Note error>{getErrorMessage(balances.error)}</Note>
          ) : !shownBalances?.length ? (
            <Note>{query && !showAll ? "Nada encontrado aqui" : "Nenhum item em estoque"}</Note>
          ) : (
            shownBalances.map((b) => (
              <NodeRow
                key={b.id}
                nodeId={b.id}
                type="b"
                label={b.item.name}
                trailing={<span className="shrink-0 text-xs font-semibold tabular-nums text-slate-300">{formatNumber(b.quantity)}</span>}
              />
            ))
          )}
          {balances.data && balances.data.totalPages > 1 && <Note>Mostrando os primeiros 100.</Note>}
        </Branch>
      )}
    </div>
  );
}

export function FacilityNode({ facility: f }: { facility: FacilitySummaryResponse }) {
  const { query, isOpen } = useMap();
  const key = nodeKey("f", f.id);
  const userOpen = isOpen(key);

  const deps = useQuery({ ...mapQueries.departaments(f.id), enabled: userOpen });
  const depList = deps.data?.items ?? [];

  // filhos já em cache, só para a busca (enabled:false não dispara requisição)
  const cached = useQueries({
    queries: depList.flatMap((d) => [
      { ...mapQueries.computers(d.id), enabled: false },
      { ...mapQueries.balances(d.id), enabled: false },
    ]),
  });

  const selfMatch = !!query && (matches(f.name, query) || matches(f.code, query));
  const childMatch =
    !!query &&
    depList.some((d, i) => {
      const c = cached[i * 2]?.data as { items: ComputerSummaryResponse[] } | undefined;
      const b = cached[i * 2 + 1]?.data as { items: StockBalanceSummaryResponse[] } | undefined;
      return departamentHits(d, query, c?.items, b?.items).visible;
    });
  if (query && !selfMatch && !childMatch) return null;

  const expanded = userOpen || (childMatch && !selfMatch);
  const loading = userOpen && deps.isLoading;

  return (
    <div>
      <NodeRow
        nodeId={f.id}
        type="f"
        label={f.name}
        expandable
        expanded={expanded}
        loading={loading}
        badges={
          <>
            <span className="text-[11px] text-slate-500">{f.code}</span>
            <Count value={deps.data?.totalItems} label="dep." />
          </>
        }
      />
      {expanded && !loading && (
        <Branch>
          {deps.error ? (
            <Note error>{getErrorMessage(deps.error)}</Note>
          ) : !depList.length ? (
            <Note>Nenhum departamento</Note>
          ) : (
            depList.map((d) => <DepartamentNode key={d.id} dep={d} parentMatched={selfMatch} />)
          )}
        </Branch>
      )}
    </div>
  );
}
