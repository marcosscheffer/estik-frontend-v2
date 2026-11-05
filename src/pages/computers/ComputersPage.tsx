import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FilterX, Monitor, Plus, SearchX } from "lucide-react";
import { useFilters } from "@/hooks/useFilters";
import { useViewMode } from "@/hooks/useViewMode";
import { computersService } from "@/services/computers";
import { formatDateTime, formatRelative } from "@/lib/format";
import { Button, Card, CardGrid, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Table, ViewToggle } from "@/components/ui";
import { ComputerCard } from "./ComputerCard";
import { DepartamentSelect, FacilitySelect } from "@/components/LookupSelects";
import { CreateComputerModal } from "./ComputerModals";

export function ComputersPage() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useViewMode("computers");
  const { filters, page, setFilter, setPage } = useFilters({ name: "", facilityId: "", departamentId: "" });

  const [, setParams] = useSearchParams();
  const hasFilters = !!(filters.name || filters.facilityId || filters.departamentId);
  const clearFilters = () => setParams(new URLSearchParams(), { replace: true });
  const empty = hasFilters ? (
    <EmptyState
      icon={<SearchX className="size-5" />}
      title="Nenhum computador encontrado"
      message="Nenhum computador bate com esses filtros."
      action={<Button size="sm" variant="secondary" icon={<FilterX className="size-4" />} onClick={clearFilters}>Limpar filtros</Button>}
    />
  ) : (
    <EmptyState
      icon={<Monitor className="size-5" />}
      title="Nenhum computador cadastrado"
      message="Cadastre as máquinas de cada unidade e departamento para acompanhar o inventário."
      action={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreateOpen(true)}>Novo computador</Button>}
    />
  );

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
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 p-4">
          <div className="w-full min-w-56 flex-1">
            <SearchInput value={filters.name} onChange={(v) => setFilter("name", v)} placeholder="Buscar por nome ou patrimônio" />
          </div>
          <FacilitySelect
            className="w-full sm:w-52"
            placeholder="Todas as unidades"
            value={filters.facilityId}
            onChange={(e) => {
              setFilter("facilityId", e.target.value);
              setFilter("departamentId", "");
            }}
          />
          <DepartamentSelect
            className="w-full sm:w-60"
            placeholder="Todos os departamentos"
            facilityId={filters.facilityId}
            value={filters.departamentId}
            onChange={(e) => setFilter("departamentId", e.target.value)}
          />
          {hasFilters && (
            <Button variant="ghost" icon={<FilterX className="size-4" />} onClick={clearFilters}>
              Limpar
            </Button>
          )}
        </div>
        {error ? (
          <div className="p-4"><ErrorState error={error} /></div>
        ) : view === "grid" ? (
          <CardGrid
            rows={data?.items}
            loading={isLoading || isFetching}
            rowKey={(c) => c.id}
            empty={empty}
            renderCard={(c) => <ComputerCard computer={c} />}
          />
        ) : (
          <Table
            rows={data?.items}
            loading={isLoading || isFetching}
            rowKey={(c) => c.id}
            onRowClick={(c) => navigate(`/computers/${c.id}`)}
            empty={empty}
            columns={[
              { header: "Nome", className: "w-full max-w-0", cell: (c) => <span className="block truncate font-medium text-slate-100" title={c.name}>{c.name}</span> },
              { header: "Unidade", cell: (c) => <span className="text-slate-400">{c.facility?.name ?? "—"}</span> },
              { header: "Departamento", cell: (c) => <span className="text-slate-400">{c.departament?.name ?? "—"}</span> },
              { header: "Atualizado", cell: (c) => <span className="text-slate-400" title={formatDateTime(c.updatedAt)}>{formatRelative(c.updatedAt)}</span> },
            ]}
          />
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} totalItems={data.totalItems} onChange={setPage} />}
      </Card>
      <CreateComputerModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(c) => navigate(`/computers/${c.id}`)} />
    </>
  );
}
