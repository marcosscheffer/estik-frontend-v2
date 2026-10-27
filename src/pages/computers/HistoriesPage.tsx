import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useFilters } from "@/hooks/useFilters";
import { historiesService, type HistoryFilters } from "@/services/computers";
import { formatDateTime, formatRelative } from "@/lib/format";
import { directionLabel, directionTone, toOptions } from "@/lib/labels";
import { Badge, Card, DetailList, ErrorState, Modal, PageHeader, Pagination, Select } from "@/components/ui";
import { DepartamentSelect } from "@/components/LookupSelects";
import { HistoryTimeline } from "./HistoryTimeline";

export function HistoriesPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const { filters, page, setFilter, setPage } = useFilters({ direction: "", departamentId: "", computerId: "" });

  const query = { ...(filters as HistoryFilters), page, size: 20 };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["histories", "list", query],
    queryFn: () => historiesService.list(query),
    placeholderData: keepPreviousData,
  });

  const detail = useQuery({
    queryKey: ["histories", "detail", selected],
    queryFn: () => historiesService.get(selected!),
    enabled: !!selected,
  });

  return (
    <>
      <PageHeader title="Histórico de computadores" description="Serviços e movimentações registrados." />
      <Card>
        <div className="grid gap-3 border-b border-slate-800 p-4 sm:grid-cols-3">
          <Select options={toOptions(directionLabel)} placeholder="Todas as direções" value={filters.direction} onChange={(e) => setFilter("direction", e.target.value)} />
          <DepartamentSelect placeholder="Todos os departamentos" value={filters.departamentId} onChange={(e) => setFilter("departamentId", e.target.value)} />
        </div>
        {error ? (
          <div className="p-4"><ErrorState error={error} /></div>
        ) : (
          <HistoryTimeline rows={data?.items} loading={isLoading || isFetching} onRowClick={(h) => setSelected(h.id)} />
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} totalItems={data.totalItems} onChange={setPage} />}
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Registro do histórico">
        {detail.isLoading && <p className="text-sm text-slate-500">Carregando...</p>}
        {detail.error && <ErrorState error={detail.error} />}
        {detail.data && (
          <div className="-mx-5 -my-4">
            <DetailList
              items={[
                {
                  label: "Computador",
                  value: detail.data.computer ? (
                    <Link className="text-brand-400 hover:underline" to={`/computers/${detail.data.computer.id}`}>
                      {detail.data.computer.name}
                    </Link>
                  ) : "—",
                },
                { label: "Direção", value: <Badge tone={directionTone[detail.data.direction]}>{directionLabel[detail.data.direction]}</Badge> },
                { label: "Serviço", value: detail.data.serviceDescription },
                {
                  label: "Registrado em",
                  value: <span title={formatDateTime(detail.data.createdAt)}>{formatDateTime(detail.data.createdAt)} ({formatRelative(detail.data.createdAt)})</span>,
                },
                ...(detail.data.computer?.updatedAt && detail.data.computer.updatedAt !== detail.data.createdAt
                  ? [{ label: "Computador atualizado em", value: formatDateTime(detail.data.computer.updatedAt) }]
                  : []),
              ]}
            />
          </div>
        )}
      </Modal>
    </>
  );
}
