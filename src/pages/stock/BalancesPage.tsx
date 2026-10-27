import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Plus } from "lucide-react";
import { useFilters } from "@/hooks/useFilters";
import { useViewMode } from "@/hooks/useViewMode";
import { stockService } from "@/services/stock";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Button, Card, CardGrid, DetailList, ErrorState, Modal, PageHeader, Pagination, Table, ViewToggle } from "@/components/ui";
import { DepartamentSelect, FacilitySelect, ItemSelect } from "@/components/LookupSelects";
import type { StockBalanceSummaryResponse } from "@/types/api";
import { MovementModal } from "./MovementModal";
import { BalanceCard } from "./BalanceCard";

export function BalancesPage() {
  const { filters, page, setFilter, setPage } = useFilters({ facilityId: "", departamentId: "", itemId: "" });
  const [selected, setSelected] = useState<StockBalanceSummaryResponse | null>(null);
  const [view, setView] = useViewMode("balances");
  const [movement, setMovement] = useState<{ open: boolean; from?: StockBalanceSummaryResponse }>({ open: false });

  const query = { ...filters, page, size: 20 };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["stock", "balances", query],
    queryFn: () => stockService.balances(query),
    placeholderData: keepPreviousData,
  });
  const detail = useQuery({
    queryKey: ["stock", "balance", selected?.id],
    queryFn: () => stockService.balance(selected!.id),
    enabled: !!selected,
  });

  return (
    <>
      <PageHeader
        title="Saldos de estoque"
        description="Saldos são só leitura: mudam apenas por movimentações."
        actions={
          <>
            <ViewToggle value={view} onChange={setView} />
            <Button icon={<Plus className="size-4" />} onClick={() => setMovement({ open: true })}>Nova movimentação</Button>
          </>
        }
      />
      <Card>
        <div className="grid gap-3 border-b border-slate-800 p-4 sm:grid-cols-3">
          <FacilitySelect placeholder="Todas as unidades" value={filters.facilityId} onChange={(e) => { setFilter("facilityId", e.target.value); setFilter("departamentId", ""); }} />
          <DepartamentSelect placeholder="Todos os departamentos" facilityId={filters.facilityId} value={filters.departamentId} onChange={(e) => setFilter("departamentId", e.target.value)} />
          <ItemSelect placeholder="Todos os itens" value={filters.itemId} onChange={(e) => setFilter("itemId", e.target.value)} />
        </div>
        {error ? <div className="p-4"><ErrorState error={error} /></div> : view === "grid" ? (
          <CardGrid
            rows={data?.items}
            loading={isLoading || isFetching}
            rowKey={(b) => b.id}
            empty="Nenhum saldo. Registre uma entrada para começar."
            renderCard={(b) => <BalanceCard balance={b} onClick={() => setSelected(b)} />}
          />
        ) : (
          <Table
            rows={data?.items}
            loading={isLoading || isFetching}
            rowKey={(b) => b.id}
            onRowClick={setSelected}
            empty="Nenhum saldo. Registre uma entrada para começar."
            columns={[
              { header: "Item", cell: (b) => <span className="font-medium text-slate-100">{b.item.name}</span> },
              { header: "SKU", cell: (b) => <span className="font-mono text-xs">{b.item.sku}</span> },
              { header: "Unidade", cell: (b) => b.facility?.name },
              { header: "Quantidade", className: "text-right", cell: (b) => <span className="font-semibold tabular-nums">{formatNumber(b.quantity)}</span> },
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
          <Button
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
