import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useFilters } from "@/hooks/useFilters";
import { useViewMode } from "@/hooks/useViewMode";
import { computersService } from "@/services/computers";
import { formatDateTime } from "@/lib/format";
import { Button, Card, CardGrid, ErrorState, PageHeader, Pagination, SearchInput, Table, ViewToggle } from "@/components/ui";
import { ComputerCard } from "./ComputerCard";
import { DepartamentSelect, FacilitySelect } from "@/components/LookupSelects";
import { CreateComputerModal } from "./ComputerModals";

export function ComputersPage() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useViewMode("computers");
  const { filters, page, setFilter, setPage } = useFilters({ name: "", facilityId: "", departamentId: "" });

  const query = { ...filters, page, size: 20 };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["computers", "list", query],
    queryFn: () => computersService.list(query),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Computadores"
        description="Inventário de máquinas por unidade e departamento."
        actions={
          <>
            <ViewToggle value={view} onChange={setView} />
            <Button icon={<Plus className="size-4" />} onClick={() => setCreateOpen(true)}>Novo computador</Button>
          </>
        }
      />
      <Card>
        <div className="grid gap-3 border-b border-slate-800 p-4 sm:grid-cols-3">
          <SearchInput value={filters.name} onChange={(v) => setFilter("name", v)} placeholder="Buscar por nome" />
          <FacilitySelect
            placeholder="Todas as unidades"
            value={filters.facilityId}
            onChange={(e) => {
              setFilter("facilityId", e.target.value);
              setFilter("departamentId", "");
            }}
          />
          <DepartamentSelect
            placeholder="Todos os departamentos"
            facilityId={filters.facilityId}
            value={filters.departamentId}
            onChange={(e) => setFilter("departamentId", e.target.value)}
          />
        </div>
        {error ? (
          <div className="p-4"><ErrorState error={error} /></div>
        ) : view === "grid" ? (
          <CardGrid
            rows={data?.items}
            loading={isLoading || isFetching}
            rowKey={(c) => c.id}
            empty="Nenhum computador encontrado."
            renderCard={(c) => <ComputerCard computer={c} />}
          />
        ) : (
          <Table
            rows={data?.items}
            loading={isLoading || isFetching}
            rowKey={(c) => c.id}
            onRowClick={(c) => navigate(`/computers/${c.id}`)}
            empty="Nenhum computador encontrado."
            columns={[
              { header: "Nome", cell: (c) => <Link to={`/computers/${c.id}`} className="font-medium text-slate-100">{c.name}</Link> },
              { header: "Unidade", cell: (c) => c.facility?.name },
              { header: "Departamento", cell: (c) => c.departament?.name },
              { header: "Atualizado em", cell: (c) => formatDateTime(c.updatedAt) },
            ]}
          />
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} totalItems={data.totalItems} onChange={setPage} />}
      </Card>
      <CreateComputerModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(c) => navigate(`/computers/${c.id}`)} />
    </>
  );
}
