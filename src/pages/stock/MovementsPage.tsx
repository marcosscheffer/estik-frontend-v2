import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, FilterX, Plus, SearchX } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useFilters } from "@/hooks/useFilters";
import { stockService, type MovementFilters } from "@/services/stock";
import { formatDateTime, formatNumber } from "@/lib/format";
import { movementLabel, movementTone, toOptions } from "@/lib/labels";
import { Badge, Button, Card, DetailList, EmptyState, ErrorState, Modal, PageHeader, Pagination, Select } from "@/components/ui";
import { DepartamentSelect, FacilitySelect } from "@/components/LookupSelects";
import { MovementModal } from "./MovementModal";
import { MovementTimeline } from "./MovementTimeline";

/** "Unidade · Departamento", sem traço quando falta um dos dois. */
function placeText(f?: { name: string } | null, d?: { name: string } | null) {
  return [f?.name, d?.name].filter(Boolean).join(" · ") || "—";
}

export function MovementsPage() {
  const { filters, page, setFilter, setPage } = useFilters({ facilityId: "", departamentId: "", type: "" });
  const [selected, setSelected] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [, setParams] = useSearchParams();
  const hasFilters = !!(filters.type || filters.facilityId || filters.departamentId);
  const clearFilters = () => setParams(new URLSearchParams(), { replace: true });

  const query = { ...(filters as MovementFilters), page, size: 20 };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["stock", "movements", query],
    queryFn: () => stockService.movements(query),
    placeholderData: keepPreviousData,
  });
  const detail = useQuery({
    queryKey: ["stock", "movement", selected],
    queryFn: () => stockService.movement(selected!),
    enabled: !!selected,
    retry: false,
  });
  // GET /stock/movements/{id} hoje falha (502) para o que não é transferência;
  // aí mostra o que já veio na lista
  const fallback = data?.items.find((x) => x.id === selected);
  const m = detail.data ?? (detail.error ? fallback : undefined);

  return (
    <>
      <PageHeader
        title="Movimentações"
        description="Entradas, saídas, ajustes e transferências de estoque."
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setCreateOpen(true)}>Nova movimentação</Button>}
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 p-4">
          <Select className="w-full sm:w-48" options={toOptions(movementLabel)} placeholder="Todos os tipos" value={filters.type} onChange={(e) => setFilter("type", e.target.value)} />
          <FacilitySelect className="w-full sm:w-52" placeholder="Todas as unidades" value={filters.facilityId} onChange={(e) => { setFilter("facilityId", e.target.value); setFilter("departamentId", ""); }} />
          <DepartamentSelect className="w-full sm:w-60" placeholder="Todos os departamentos" facilityId={filters.facilityId} value={filters.departamentId} onChange={(e) => setFilter("departamentId", e.target.value)} />
          {hasFilters && (
            <Button variant="ghost" icon={<FilterX className="size-4" />} onClick={clearFilters}>
              Limpar
            </Button>
          )}
        </div>
        {error ? <div className="p-4"><ErrorState error={error} /></div> : (
          <MovementTimeline
            rows={data?.items}
            loading={isLoading || isFetching}
            onRowClick={(x) => setSelected(x.id)}
            empty={
              hasFilters ? (
                <EmptyState
                  icon={<SearchX className="size-5" />}
                  title="Nenhuma movimentação encontrada"
                  message="Nenhuma movimentação bate com esses filtros."
                  action={<Button size="sm" variant="secondary" icon={<FilterX className="size-4" />} onClick={clearFilters}>Limpar filtros</Button>}
                />
              ) : (
                <EmptyState
                  icon={<ArrowRightLeft className="size-5" />}
                  title="Nenhuma movimentação ainda"
                  message="Entradas, saídas, ajustes e transferências aparecem aqui, da mais recente para a mais antiga."
                  action={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreateOpen(true)}>Nova movimentação</Button>}
                />
              )
            }
          />
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} totalItems={data.totalItems} onChange={setPage} />}
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Movimentação">
        {detail.isLoading && <p className="text-sm text-slate-500">Carregando...</p>}
        {detail.error && !fallback && <ErrorState error={detail.error} />}
        {m && (
          <div className="-mx-5 -my-4">
            <DetailList
              items={[
                { label: "Tipo", value: <Badge tone={movementTone[m.type]}>{movementLabel[m.type]}</Badge> },
                { label: "Quantidade", value: formatNumber(m.quantity) },
                { label: "Item", value: `${m.item?.name} (${m.item?.sku})` },
                { label: "Data", value: formatDateTime(m.createdAt) },
                ...(m.type === "TRANSFER"
                  ? [
                      { label: "Origem", value: placeText(m.facilitySource, m.departamentSource) },
                      { label: "Destino", value: placeText(m.facilityDestination, m.departamentDestination) },
                    ]
                  : [
                      {
                        label: "Local",
                        value: m.facilityDestination || m.departamentDestination
                          ? placeText(m.facilityDestination, m.departamentDestination)
                          : placeText(m.facilitySource, m.departamentSource),
                      },
                    ]),
                ...(detail.data ? [{ label: "Observação", value: detail.data.description || "—" }] : []),
              ]}
            />
          </div>
        )}
      </Modal>

      <MovementModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
