import { useState } from "react";
import clsx from "clsx";
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
import { BalanceCard, MinimumTag } from "./BalanceCard";
import { minimumOf, minimumState } from "@/lib/stock";

export function BalancesPage() {
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
      action={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setMovement({ open: true })}>Registrar entrada</Button>}
    />
  );

  // filtro só nesta página (o backend não filtra por mínimo)
  const [onlyBelow, setOnlyBelow] = useState(false);

  const query = { ...filters, page, size: 20 };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["stock", "balances", query],
    queryFn: () => stockService.balances(query),
    placeholderData: keepPreviousData,
  });
  const rows = onlyBelow ? data?.items.filter((b) => minimumState(b) === "below") : data?.items;

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
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 p-4">
          <FacilitySelect className="w-full sm:w-52" placeholder="Todas as unidades" value={filters.facilityId} onChange={(e) => { setFilter("facilityId", e.target.value); setFilter("departamentId", ""); }} />
          <DepartamentSelect className="w-full sm:w-60" placeholder="Todos os departamentos" facilityId={filters.facilityId} value={filters.departamentId} onChange={(e) => setFilter("departamentId", e.target.value)} />
          <ItemSelect className="w-full sm:w-56" placeholder="Todos os itens" value={filters.itemId} onChange={(e) => setFilter("itemId", e.target.value)} />
          <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-slate-300" title="Filtra só os saldos desta página">
            <input type="checkbox" className="size-4 rounded border-slate-600 bg-slate-900 accent-red-500" checked={onlyBelow} onChange={(e) => setOnlyBelow(e.target.checked)} />
            Abaixo do mínimo (nesta página)
          </label>
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
            rowClassName={(b) =>
              minimumState(b) === "below"
                ? "bg-red-950/40 shadow-[inset_4px_0_0_0_theme(colors.red.500)]"
                : minimumState(b) === "at" && "shadow-[inset_4px_0_0_0_theme(colors.amber.500)]"
            }
            empty={empty}
            columns={[
              { header: "Item", cell: (b) => <span className="font-medium text-slate-100">{b.item.name}</span> },
              { header: "SKU", cell: (b) => <span className="font-mono text-xs">{b.item.sku}</span> },
              { header: "Unidade", cell: (b) => b.facility?.name },
              { header: "Situação", cell: (b) => <MinimumTag state={minimumState(b)} showOk /> },
              { header: "Mínimo", className: "text-right", cell: (b) => <span className="tabular-nums text-slate-400">{minimumOf(b) !== undefined ? formatNumber(minimumOf(b)!) : "—"}</span> },
              {
                header: "Quantidade",
                className: "text-right",
                cell: (b) => (
                  <span className={clsx("font-semibold tabular-nums", minimumState(b) === "below" && "text-red-300")}>{formatNumber(b.quantity)}</span>
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
                { label: "Estoque mínimo", value: minimumOf(detail.data) !== undefined ? formatNumber(minimumOf(detail.data)!) : "—" },
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
