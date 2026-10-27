import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Boxes, Monitor, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useDepartamentOptions, useFacilityOptions } from "@/hooks/useLookups";
import { departamentsService } from "@/services/departaments";
import { computersService, historiesService } from "@/services/computers";
import { stockService } from "@/services/stock";
import { formatNumber } from "@/lib/format";
import {
  Button,
  Card,
  CardGrid,
  ConfirmDialog,
  ErrorState,
  PageHeader,
  PageLoader,
  Pagination,
  Tabs,
  TileIcon,
} from "@/components/ui";
import { ComputerCard } from "@/pages/computers/ComputerCard";
import { CreateComputerModal } from "@/pages/computers/ComputerModals";
import { HistoryTimeline } from "@/pages/computers/HistoryTimeline";
import { BalanceCard } from "@/pages/stock/BalanceCard";
import { MovementModal } from "@/pages/stock/MovementModal";
import { MovementTimeline } from "@/pages/stock/MovementTimeline";
import { DepartamentModal } from "./DepartamentsPage";

type Tab = "computers" | "stock" | "movements" | "history";
const tabs: { key: Tab; label: string }[] = [
  { key: "computers", label: "Computadores" },
  { key: "stock", label: "Estoque" },
  { key: "movements", label: "Movimentações" },
  { key: "history", label: "Histórico" },
];

function Summary({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value?: number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <TileIcon icon={icon} />
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-semibold tabular-nums text-slate-100">{value == null ? "—" : formatNumber(value)}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </Card>
  );
}

export function DepartamentDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [modal, setModal] = useState<null | "edit" | "delete" | "computer" | "movement">(null);

  const tab = (tabs.some((t) => t.key === params.get("tab")) ? params.get("tab") : "computers") as Tab;
  const page = Number(params.get("page") ?? 0);
  const setTab = (t: Tab) => setParams(t === "computers" ? {} : { tab: t }, { replace: true });
  const setPage = (p: number) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (p > 0) next.set("page", String(p));
      else next.delete("page");
      return next;
    });

  const { data: dep, isLoading, error } = useQuery({
    queryKey: ["departaments", "detail", id],
    queryFn: () => departamentsService.get(id),
  });
  const facilityId = dep?.facility.id;

  // Deixa as listas dos <select> em cache antes de abrir os modais já preenchidos.
  useFacilityOptions();
  useDepartamentOptions(facilityId);

  /* ---------- resumo ---------- */
  const computerCount = useQuery({
    queryKey: ["computers", "list", { departamentId: id, size: 1 }],
    queryFn: () => computersService.list({ departamentId: id, size: 1 }),
  });
  // 100 é o máximo por página da API; a soma usa só os saldos carregados.
  const balanceSummary = useQuery({
    queryKey: ["stock", "balances", { departamentId: id, size: 100 }],
    queryFn: () => stockService.balances({ departamentId: id, size: 100 }),
  });
  const totalUnits = balanceSummary.data?.items.reduce((sum, b) => sum + b.quantity, 0);
  const partialSum = (balanceSummary.data?.totalPages ?? 0) > 1;

  /* ---------- abas ---------- */
  const computersQuery = { departamentId: id, page, size: 12 };
  const computers = useQuery({
    queryKey: ["computers", "list", computersQuery],
    queryFn: () => computersService.list(computersQuery),
    placeholderData: keepPreviousData,
    enabled: tab === "computers",
  });
  const balancesQuery = { departamentId: id, page, size: 12 };
  const balances = useQuery({
    queryKey: ["stock", "balances", balancesQuery],
    queryFn: () => stockService.balances(balancesQuery),
    placeholderData: keepPreviousData,
    enabled: tab === "stock",
  });
  const movementsQuery = { departamentId: id, page, size: 20 };
  const movements = useQuery({
    queryKey: ["stock", "movements", movementsQuery],
    queryFn: () => stockService.movements(movementsQuery),
    placeholderData: keepPreviousData,
    enabled: tab === "movements",
  });
  const historyQuery = { departamentId: id, page, size: 20 };
  const history = useQuery({
    queryKey: ["histories", "list", historyQuery],
    queryFn: () => historiesService.list(historyQuery),
    placeholderData: keepPreviousData,
    enabled: tab === "history",
  });

  const remove = useApiMutation({
    mutationFn: () => departamentsService.remove(id),
    invalidate: [["departaments"], ["lookup", "departaments"]],
    success: "Departamento excluído",
    onSuccess: () => navigate("/departaments"),
  });

  if (isLoading) return <PageLoader />;
  if (error || !dep) return <ErrorState error={error} />;

  const current = { computers, stock: balances, movements, history }[tab];

  return (
    <>
      <PageHeader
        back="/departaments"
        title={dep.name}
        description={`${dep.code} · ${dep.facility?.name ?? "—"}`}
        actions={
          <>
            <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setModal("edit")}>Editar</Button>
            <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setModal("delete")} aria-label="Excluir" />
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Summary label="Computadores" value={computerCount.data?.totalItems} icon={Monitor} />
        <Summary label="Itens em estoque" value={balanceSummary.data?.totalItems} icon={Package} />
        <Summary
          label="Unidades totais"
          value={totalUnits}
          icon={Boxes}
          hint={partialSum ? "Soma dos primeiros 100 saldos" : undefined}
        />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        {tab === "computers" && (
          <Button icon={<Plus className="size-4" />} onClick={() => setModal("computer")}>Novo computador</Button>
        )}
        {tab === "stock" && (
          <Button icon={<Plus className="size-4" />} onClick={() => setModal("movement")}>Nova movimentação</Button>
        )}
      </div>

      <Card>
        {current.error ? (
          <div className="p-4"><ErrorState error={current.error} /></div>
        ) : tab === "computers" ? (
          <CardGrid
            rows={computers.data?.items}
            loading={computers.isLoading || computers.isFetching}
            rowKey={(c) => c.id}
            empty="Nenhum computador neste departamento."
            renderCard={(c) => <ComputerCard computer={c} />}
          />
        ) : tab === "stock" ? (
          <CardGrid
            rows={balances.data?.items}
            loading={balances.isLoading || balances.isFetching}
            rowKey={(b) => b.id}
            empty="Nenhum saldo neste departamento."
            renderCard={(b) => <BalanceCard balance={b} />}
          />
        ) : tab === "movements" ? (
          <MovementTimeline
            rows={movements.data?.items}
            loading={movements.isLoading || movements.isFetching}
            currentDepartamentId={id}
          />
        ) : (
          <HistoryTimeline rows={history.data?.items} loading={history.isLoading || history.isFetching} />
        )}
        {current.data && (
          <Pagination page={page} totalPages={current.data.totalPages} totalItems={current.data.totalItems} onChange={setPage} />
        )}
      </Card>

      <DepartamentModal open={modal === "edit"} onClose={() => setModal(null)} dep={dep} />
      <ConfirmDialog
        open={modal === "delete"}
        title="Excluir departamento?"
        message={<>O departamento <strong>{dep.name}</strong> será excluído.</>}
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setModal(null)}
      />
      <CreateComputerModal
        open={modal === "computer"}
        onClose={() => setModal(null)}
        defaultFacilityId={facilityId}
        defaultDepartamentId={id}
      />
      <MovementModal
        open={modal === "movement"}
        onClose={() => setModal(null)}
        facilityId={facilityId}
        departamentId={id}
      />
    </>
  );
}
