import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFilters } from "@/hooks/useFilters";
import { ticketsService, type TicketFilters } from "@/services/tickets";
import { access } from "@/lib/roles";
import { formatDateTime } from "@/lib/format";
import { priorityLabel, priorityTone, statusLabel, statusTone, ticketTypeLabel, toOptions } from "@/lib/labels";
import { useViewMode } from "@/hooks/useViewMode";
import { Badge, Button, Card, CardGrid, ErrorState, PageHeader, Pagination, SearchInput, Select, Table, Tabs, ViewToggle } from "@/components/ui";
import { FacilitySelect } from "@/components/LookupSelects";
import { TicketFormModal } from "./TicketFormModal";
import { TicketCard } from "./TicketCard";

type Scope = "all" | "mine" | "assigned";

export function TicketsPage() {
  const { claims, can } = useAuth();
  const me = claims!.sub;
  const [params, setParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [view, setView] = useViewMode("tickets");

  const { filters, page, setFilter, setPage } = useFilters({
    title: "",
    status: "",
    priority: "",
    type: "",
    facilityId: "",
    requesterId: "",
    assigneeId: "",
  });

  // /tickets?new=1 abre o formulário direto (link do dashboard).
  useEffect(() => {
    if (params.get("new")) {
      setFormOpen(true);
      params.delete("new");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const query: TicketFilters = { ...(filters as TicketFilters), page, size: 20 };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["tickets", "list", query],
    queryFn: () => ticketsService.list(query),
    placeholderData: keepPreviousData,
  });

  const scope = filters.requesterId === me ? "mine" : filters.assigneeId === me ? "assigned" : "all";
  const setScope = (s: Scope) => {
    const next = new URLSearchParams(params);
    next.delete("page");
    next.delete("requesterId");
    next.delete("assigneeId");
    if (s === "mine") next.set("requesterId", me);
    if (s === "assigned") next.set("assigneeId", me);
    setParams(next, { replace: true });
  };

  const tabs: { key: Scope; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "mine", label: "Abertos por mim" },
    ...(can(access.assumeTickets) ? [{ key: "assigned" as const, label: "Atribuídos a mim" }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Chamados"
        description="Abra, acompanhe e atenda chamados de TI e Arquitetura."
        actions={
          <>
            <ViewToggle value={view} onChange={setView} />
            <Button icon={<Plus className="size-4" />} onClick={() => setFormOpen(true)}>
              Abrir chamado
            </Button>
          </>
        }
      />

      <Tabs tabs={tabs} value={scope} onChange={setScope} />

      <Card>
        <div className="grid gap-3 border-b border-slate-800 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-1">
            <SearchInput value={filters.title} onChange={(v) => setFilter("title", v)} placeholder="Buscar por título" />
          </div>
          <Select options={toOptions(statusLabel)} placeholder="Todos os status" value={filters.status} onChange={(e) => setFilter("status", e.target.value)} />
          <Select options={toOptions(priorityLabel)} placeholder="Todas as prioridades" value={filters.priority} onChange={(e) => setFilter("priority", e.target.value)} />
          <Select options={toOptions(ticketTypeLabel)} placeholder="Todos os tipos" value={filters.type} onChange={(e) => setFilter("type", e.target.value)} />
          <FacilitySelect placeholder="Todas as unidades" value={filters.facilityId} onChange={(e) => setFilter("facilityId", e.target.value)} />
        </div>

        {error ? (
          <div className="p-4">
            <ErrorState error={error} />
          </div>
        ) : view === "grid" ? (
          <CardGrid
            rows={data?.items}
            loading={isLoading || isFetching}
            rowKey={(t) => t.id}
            empty="Nenhum chamado encontrado com esses filtros."
            renderCard={(t) => <TicketCard ticket={t} />}
          />
        ) : (
          <Table
            rows={data?.items}
            loading={isLoading || isFetching}
            rowKey={(t) => t.id}
            empty="Nenhum chamado encontrado com esses filtros."
            columns={[
              {
                header: "Título",
                cell: (t) => (
                  <Link to={`/tickets/${t.id}`} className="font-medium text-slate-100 hover:text-brand-600">
                    {t.title}
                  </Link>
                ),
              },
              { header: "Tipo", cell: (t) => ticketTypeLabel[t.ticketType] },
              { header: "Status", cell: (t) => <Badge tone={statusTone[t.status]}>{statusLabel[t.status]}</Badge> },
              { header: "Prioridade", cell: (t) => <Badge tone={priorityTone[t.priority]}>{priorityLabel[t.priority]}</Badge> },
              { header: "Unidade", cell: (t) => t.facility?.name },
              { header: "Aberto em", cell: (t) => formatDateTime(t.createdAt) },
            ]}
          />
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} totalItems={data.totalItems} onChange={setPage} />}
      </Card>

      <TicketFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </>
  );
}
