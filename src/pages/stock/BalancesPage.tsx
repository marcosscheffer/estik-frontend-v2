import { access } from "@/lib/permissions";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Boxes, FilterX, Plus, SearchX } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useFilters } from "@/hooks/useFilters";
import { useViewMode } from "@/hooks/useViewMode";
import { stockService } from "@/services/stock";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Button, Card, CardGrid, DetailList, EmptyState, ErrorState, Modal, PageHeader, Pagination, Table, ViewToggle } from "@/components/ui";
import { DepartamentSelect, FacilitySelect, ItemSelect } from "@/components/LookupSelects";
import type { StockBalanceSummaryResponse } from "@/types/api";
import { MovementModal } from "./MovementModal";
import { BalanceCard } from "./BalanceCard";

export function BalancesPage() {
  // só quem pode alterar vê os botões de criar/editar (o backend também bloqueia)
  const { can } = useAuth();
  const canWrite = can(access.stockWrite);
  const { filters, page, setFilter, setPage } = useFilters({ facilityId: "", departamentId: "", itemId: "" });
  const [selected, setSelected] = useState<StockBalanceSummaryResponse | null>(null);
  const [view, setView] = useViewMode("balances");
  const [movement, setMovement] = useState<{ open: boolean; from?: StockBalanceSummaryResponse }>({ open: false });

  const [, setParams] = useSearchParams();
  const hasFilters = !!(filters.facilityId || filters.departamentId || filters.itemId);
  const clearFilters = () => setParams(new URLSearchParams(), { replace: true });
  const empty = hasFilters ? (
    <EmptyState
      icon={<SearchX className="size-5" />}
      title="Nenhum saldo encontrado"
      message="Nenhum saldo bate com esses filtros."
      action={<Button size="sm" variant="secondary" icon={<FilterX className="size-4" />} onClick={clearFilters}>Limpar filtros</Button>}
    />
  ) : (
    <EmptyState
      icon={<Boxes className="size-5" />}
      title="Nenhum saldo ainda"
      message="O saldo de cada item por departamento aparece aqui depois da primeira entrada de estoque."
      action={canWrite ? <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setMovement({ open: true })}>Registrar entrada</Button> : undefined}
    />
  );

  const query = { ...filters, page, size: 20 };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["stock", "balances", query],
    queryFn: () => stockService.balances(query),
    placeholderData: keepPreviousData,
  });
  const rows = data?.items;

  const detail = useQuery({
    queryKey: ["stock", "balance", selected?.id],
    queryFn: () => stockService.balance(selected!.id),
    enabled: !!selected,
  });

  return (
    <>
      <PageHeader
        title="Todos os saldos"
        description="Um saldo por item e departamento. Saldos são só leitura: mudam apenas por movimentações."
        back="/stock/balances"
        actions={
          <>
            <ViewToggle value={view} onChange={setView} />
            {canWrite && <Button icon={<Plus className="size-4" />} onClick={() => setMovement({ open: true })}>Nova movimentação</Button>}
          </>
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 p-4">
          <FacilitySelect className="w-full sm:w-52" placeholder="Todas as unidades" value={filters.facilityId} onChange={(e) => { setFilter("facilityId", e.target.value); setFilter("departamentId", ""); }} />
          <DepartamentSelect className="w-full sm:w-60" placeholder="Todos os departamentos" facilityId={filters.facilityId} value={filters.departamentId} onChange={(e) => setFilter("departamentId", e.target.value)} />
          <ItemSelect className="w-full sm:w-56" placeholder="Todos os itens" value={filters.itemId} onChange={(e) => setFilter("itemId", e.target.value)} />
          {hasFilters && (
            <Button variant="ghost" icon={<FilterX className="size-4" />} onClick={clearFilters}>
              Limpar
            </Button>
          )}
        </div>
        {error ? <div className="p-4"><ErrorState error={error} /></div> : view === "grid" ? (
          <CardGrid
            rows={rows}
            loading={isLoading || isFetching}
            rowKey={(b) => b.id}
            empty={empty}
            renderCard={(b) => <BalanceCard balance={b} onClick={() => setSelected(b)} />}
          />
        ) : (
          <Table
            rows={rows}
            loading={isLoading || isFetching}
            rowKey={(b) => b.id}
            onRowClick={setSelected}
            empty={empty}
            columns={[
              { header: "Item", cell: (b) => <span className="font-medium text-slate-100">{b.item.name}</span> },
              { header: "SKU", cell: (b) => <span className="font-mono text-xs">{b.item.sku}</span> },
              { header: "Unidade", cell: (b) => b.facility?.name },
              {
                header: "Quantidade",
                className: "text-right",
                cell: (b) => (
                  <span className="font-semibold tabular-nums">{formatNumber(b.quantity)}</span>
                ),
              },
            ]}
          />
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} totalItems={data.totalItems} onChange={setPage} />}
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.item.name ?? ""}
        description="Detalhe do saldo"
        footer={
          canWrite && <Button
            icon={<ArrowRightLeft className="size-4" />}
            onClick={() => {
              setMovement({ open: true, from: selected! });
              setSelected(null);
            }}
          >
            Transferir deste saldo
          </Button>
        }
      >
        {detail.error && <ErrorState error={detail.error} />}
        {detail.data && (
          <div className="-mx-5 -my-4">
            <DetailList
              items={[
                { label: "Item", value: `${detail.data.item.name} (${detail.data.item.sku})` },
                { label: "Quantidade", value: formatNumber(detail.data.quantity) },
                { label: "Unidade", value: detail.data.facility?.name },
                { label: "Departamento", value: detail.data.departament?.name },
                { label: "Atualizado em", value: formatDateTime(detail.data.updatedAt) },
              ]}
            />
          </div>
        )}
      </Modal>

      <MovementModal
        open={movement.open}
        onClose={() => setMovement({ open: false })}
        initialKind={movement.from ? "transfer" : "entry"}
        fromBalance={movement.from}
      />
    </>
  );
}
