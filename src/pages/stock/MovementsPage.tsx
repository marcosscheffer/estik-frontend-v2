import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useFilters } from "@/hooks/useFilters";
import { stockService, type MovementFilters } from "@/services/stock";
import { formatDateTime, formatNumber } from "@/lib/format";
import { movementLabel, movementTone, toOptions } from "@/lib/labels";
import { Badge, Button, Card, DetailList, ErrorState, Modal, PageHeader, Pagination, Select } from "@/components/ui";
import { DepartamentSelect, FacilitySelect } from "@/components/LookupSelects";
import { MovementModal } from "./MovementModal";
import { MovementTimeline } from "./MovementTimeline";

export function MovementsPage() {
  const { filters, page, setFilter, setPage } = useFilters({ facilityId: "", departamentId: "", type: "" });
  const [selected, setSelected] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

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
  });
  const m = detail.data;

  return (
    <>
      <PageHeader
        title="Movimentações"
        description="Entradas, saídas, ajustes e transferências de estoque."
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setCreateOpen(true)}>Nova movimentação</Button>}
      />
      <Card>
        <div className="grid gap-3 border-b border-slate-800 p-4 sm:grid-cols-3">
          <Select options={toOptions(movementLabel)} placeholder="Todos os tipos" value={filters.type} onChange={(e) => setFilter("type", e.target.value)} />
          <FacilitySelect placeholder="Todas as unidades" value={filters.facilityId} onChange={(e) => { setFilter("facilityId", e.target.value); setFilter("departamentId", ""); }} />
          <DepartamentSelect placeholder="Todos os departamentos" facilityId={filters.facilityId} value={filters.departamentId} onChange={(e) => setFilter("departamentId", e.target.value)} />
        </div>
        {error ? <div className="p-4"><ErrorState error={error} /></div> : (
          <MovementTimeline rows={data?.items} loading={isLoading || isFetching} onRowClick={(x) => setSelected(x.id)} />
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} totalItems={data.totalItems} onChange={setPage} />}
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Movimentação">
        {detail.error && <ErrorState error={detail.error} />}
        {m && (
          <div className="-mx-5 -my-4">
            <DetailList
              items={[
                { label: "Tipo", value: <Badge tone={movementTone[m.type]}>{movementLabel[m.type]}</Badge> },
                { label: "Quantidade", value: formatNumber(m.quantity) },
                { label: "Item", value: `${m.item?.name} (${m.item?.sku})` },
                { label: "Data", value: formatDateTime(m.createdAt) },
                { label: "Origem", value: m.facilitySource ? `${m.facilitySource.name} · ${m.departamentSource?.name ?? "—"}` : "—" },
                { label: "Destino", value: m.facilityDestination ? `${m.facilityDestination.name} · ${m.departamentDestination?.name ?? "—"}` : "—" },
                { label: "Observação", value: m.description || "—" },
              ]}
            />
          </div>
        )}
      </Modal>

      <MovementModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
