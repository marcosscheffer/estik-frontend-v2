import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, MousePointerClick } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/contexts/AuthContext";
import { mapQueries } from "@/hooks/useMapQueries";
import { facilitiesService } from "@/services/facilities";
import { departamentsService } from "@/services/departaments";
import { computersService } from "@/services/computers";
import { stockService } from "@/services/stock";
import { access } from "@/lib/roles";
import { formatDateTime, formatNumber } from "@/lib/format";
import { osLabel, storageTypeLabel } from "@/lib/labels";
import { DetailList, ErrorState, PageLoader } from "@/components/ui";
import type { DepartamentSummaryResponse, FacilitySummaryResponse, PageResult } from "@/types/api";
import { nodeKey, nodeStyle, type NodeType } from "./MapTree";

function Header({ type, title, subtitle }: { type: NodeType; title: string; subtitle?: React.ReactNode }) {
  const { icon: Icon, color, bg } = nodeStyle[type];
  const kind = { f: "Unidade", d: "Departamento", c: "Computador", b: "Saldo de estoque" }[type];
  return (
    <div className="flex items-start gap-3 border-b border-slate-800 px-5 py-4">
      <span className={clsx("flex size-10 shrink-0 items-center justify-center rounded-lg", bg, color)}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className={clsx("text-xs font-medium uppercase tracking-wide", color)}>{kind}</p>
        <h2 className="truncate text-lg font-semibold text-slate-100">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function GoLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-800 px-5 py-3">
      <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-brand-400 hover:text-brand-300">
        {children} <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-lg bg-slate-800/40 p-3 ring-1 ring-slate-800">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-100">{value == null ? "—" : formatNumber(value)}</p>
    </div>
  );
}

/** Procura um registro nas listas que já estão em cache (evita uma requisição extra). */
function useCachedFromLists<T extends { id: string }>(prefix: string[], id: string) {
  const client = useQueryClient();
  for (const [, data] of client.getQueriesData<PageResult<T>>({ queryKey: prefix })) {
    const hit = data?.items?.find((x) => x.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/* ---------------- por tipo ---------------- */

function FacilityDetail({ id, onSelect }: { id: string; onSelect: (key: string) => void }) {
  const cached = useCachedFromLists<FacilitySummaryResponse>(["facilities", "list"], id);
  const fetched = useQuery({
    queryKey: ["facilities", "detail", id],
    queryFn: () => facilitiesService.get(id),
    enabled: !cached,
  });
  const f = cached ?? fetched.data;
  const deps = useQuery(mapQueries.departaments(id));

  if (!f) return fetched.error ? <div className="p-5"><ErrorState error={fetched.error} /></div> : <PageLoader />;
  return (
    <>
      <Header type="f" title={f.name} subtitle={`Código ${f.code}`} />
      <div className="px-5 py-4">
        <p className="mb-3 text-sm font-medium text-slate-300">
          Departamentos {deps.data && <span className="text-slate-500">({deps.data.totalItems})</span>}
        </p>
        {deps.error && <ErrorState error={deps.error} />}
        {deps.isLoading && <p className="text-sm text-slate-500">Carregando...</p>}
        {deps.data && !deps.data.items.length && <p className="text-sm text-slate-500">Nenhum departamento.</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {deps.data?.items.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelect(nodeKey("d", d.id))}
              className="flex items-center gap-2 rounded-lg bg-slate-800/40 px-3 py-2 text-left text-sm ring-1 ring-slate-800 transition hover:bg-slate-800/70 hover:ring-slate-700"
            >
              <nodeStyle.d.icon className={clsx("size-4 shrink-0", nodeStyle.d.color)} />
              <span className="min-w-0 flex-1 truncate text-slate-200">{d.name}</span>
              <span className="text-xs text-slate-500">{d.code}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function DepartamentDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const cached = useCachedFromLists<DepartamentSummaryResponse>(["departaments", "list"], id);
  const fetched = useQuery({
    queryKey: ["departaments", "detail", id],
    queryFn: () => departamentsService.get(id),
    enabled: !cached,
  });
  const d = cached ?? fetched.data;
  const computers = useQuery(mapQueries.computerCount(id));
  const balances = useQuery(mapQueries.balances(id));
  const units = balances.data?.items.reduce((sum, b) => sum + b.quantity, 0);

  if (!d) return fetched.error ? <div className="p-5"><ErrorState error={fetched.error} /></div> : <PageLoader />;
  return (
    <>
      <Header type="d" title={d.name} subtitle={`${d.code} · ${d.facility?.name ?? "—"}`} />
      <div className="grid grid-cols-3 gap-3 px-5 py-4">
        <Stat label="Computadores" value={computers.data?.totalItems} />
        <Stat label="Itens" value={balances.data?.totalItems} />
        <Stat label="Unidades" value={units} />
      </div>
      {balances.data && balances.data.totalPages > 1 && (
        <p className="-mt-2 px-5 pb-3 text-xs text-slate-500">A soma considera os primeiros 100 saldos.</p>
      )}
      {can(access.departaments) && <GoLink to={`/departaments/${id}`}>Abrir departamento</GoLink>}
    </>
  );
}

function ComputerDetail({ id }: { id: string }) {
  const { data: pc, error } = useQuery({
    queryKey: ["computers", "detail", id],
    queryFn: () => computersService.get(id),
  });
  if (error) return <div className="p-5"><ErrorState error={error} /></div>;
  if (!pc) return <PageLoader />;
  return (
    <>
      <Header type="c" title={pc.name} subtitle={`${pc.facility?.name} · ${pc.departament?.name}`} />
      <DetailList
        items={[
          { label: "Processador", value: pc.cpu },
          { label: "Memória", value: pc.ram },
          { label: "Sistema", value: osLabel[pc.os] },
          { label: "Armazenamento", value: `${pc.storage} (${storageTypeLabel[pc.storageType]})` },
          { label: "Atualizado em", value: formatDateTime(pc.updatedAt) },
        ]}
      />
      <GoLink to={`/computers/${pc.id}`}>Abrir computador</GoLink>
    </>
  );
}

function BalanceDetail({ id }: { id: string }) {
  const { data: b, error } = useQuery({
    queryKey: ["stock", "balance", id],
    queryFn: () => stockService.balance(id),
  });
  if (error) return <div className="p-5"><ErrorState error={error} /></div>;
  if (!b) return <PageLoader />;
  return (
    <>
      <Header type="b" title={b.item.name} subtitle={<span className="font-mono text-xs">{b.item.sku}</span>} />
      <div className="px-5 py-4">
        <p className="text-xs text-slate-500">Quantidade</p>
        <p className="text-5xl font-semibold tabular-nums text-slate-100">{formatNumber(b.quantity)}</p>
      </div>
      <DetailList
        items={[
          { label: "Unidade", value: b.facility?.name },
          { label: "Departamento", value: b.departament?.name },
          { label: "Atualizado em", value: formatDateTime(b.updatedAt) },
        ]}
      />
      <GoLink to={`/stock/balances?itemId=${b.item.id}`}>Ver saldos deste item</GoLink>
    </>
  );
}

export function MapDetail({ selected, onSelect }: { selected: string | null; onSelect: (key: string) => void }) {
  if (!selected) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center text-sm text-slate-500">
        <MousePointerClick className="size-8 text-slate-600" />
        <p>Selecione uma unidade, departamento, computador ou item no mapa para ver os detalhes.</p>
      </div>
    );
  }
  const [type, id] = selected.split(":") as [NodeType, string];
  // key: troca de nó recria o painel (sem resto de estado do anterior)
  if (type === "f") return <FacilityDetail key={id} id={id} onSelect={onSelect} />;
  if (type === "d") return <DepartamentDetail key={id} id={id} />;
  if (type === "c") return <ComputerDetail key={id} id={id} />;
  if (type === "b") return <BalanceDetail key={id} id={id} />;
  return null;
}
