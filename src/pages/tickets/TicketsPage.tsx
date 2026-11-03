import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFilters } from "@/hooks/useFilters";
import { ticketsService, type TicketFilters } from "@/services/tickets";
import { access, canForwardTickets, receivesTickets, seesOnlyForwardedTickets, ticketTypeOf } from "@/lib/roles";
import { formatDateTime } from "@/lib/format";
import { priorityLabel, priorityTone, statusLabel, statusTone, ticketTypeLabel, toOptions } from "@/lib/labels";
import { useViewMode } from "@/hooks/useViewMode";
import { Badge, Button, Card, CardGrid, ErrorState, PageHeader, Pagination, SearchInput, Select, Table, Tabs, ViewToggle } from "@/components/ui";
import { FacilitySelect } from "@/components/LookupSelects";
import { TicketFormModal } from "./TicketFormModal";
import { TicketCard } from "./TicketCard";
import type { TicketSummaryResponse } from "@/types/api";

type Scope = "all" | "mine" | "unforwarded" | "sent" | "forwarded" | "assigned";

/** Valor na URL para "todas as áreas" quando o padrão do filtro é a área do usuário. */
const ALL_TYPES = "ALL";

export function TicketsPage() {
  const { claims, me: user, can } = useAuth();
  const me = claims!.sub;
  const [params, setParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [view, setView] = useViewMode("tickets");
  const role = claims?.role;
  const isStaff = can(access.ticketStaff);
  const dispatcher = canForwardTickets(role);
  const onlyForwarded = seesOnlyForwardedTickets(role);

  // Quem encaminha vê por padrão a própria área; o backend não força isso.
  // O técnico não: ele pode receber chamado de outra área.
  const defaultType = (dispatcher && ticketTypeOf(user?.function)) || "";

  const { filters, page, setFilter, setPage } = useFilters({
    title: "",
    status: "",
    priority: "",
    type: defaultType,
    facilityId: "",
    requesterId: "",
    regulatorId: "",
    forwardedId: "",
    forwarded: "",
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

  const urlScope: Scope =
    filters.requesterId === me
      ? "mine"
      : filters.regulatorId === me
        ? "sent"
        : filters.forwardedId === me
          ? "forwarded"
          : filters.assigneeId === me
            ? "assigned"
            : dispatcher && filters.forwarded === "false"
              ? "unforwarded"
              : "all";
  // técnico não tem "Todos": sem escopo na URL ele cai em "Encaminhados a mim"
  const scope: Scope = onlyForwarded && urlScope === "all" ? "forwarded" : urlScope;

  const { forwarded: _forwardedParam, ...urlFilters } = filters;
  const query: TicketFilters = {
    ...(urlFilters as TicketFilters),
    type: filters.type === ALL_TYPES ? undefined : (filters.type as TicketFilters["type"]),
    // na URL é string; para a API vai como boolean (GET /tickets?forwarded=false)
    forwarded: scope === "unforwarded" ? false : undefined,
    ...(scope === "forwarded" ? { forwardedId: me } : {}),
    page,
    size: 20,
  };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["tickets", "list", query],
    queryFn: () => ticketsService.list(query),
    placeholderData: keepPreviousData,
    // espera o perfil carregar para não buscar sem o filtro de área e logo depois com ele
    enabled: !isStaff || !!user,
  });

  const setScope = (s: Scope) => {
    const next = new URLSearchParams(params);
    next.delete("page");
    next.delete("requesterId");
    next.delete("regulatorId");
    next.delete("forwardedId");
    next.delete("forwarded");
    next.delete("assigneeId");
    if (s === "unforwarded") next.set("forwarded", "false");
    if (s === "mine") next.set("requesterId", me);
    if (s === "sent") next.set("regulatorId", me);
    if (s === "forwarded") next.set("forwardedId", me);
    if (s === "assigned") next.set("assigneeId", me);
    setParams(next, { replace: true });
  };

  const tabs: { key: Scope; label: string }[] = [
    ...(onlyForwarded ? [] : [{ key: "all" as const, label: "Todos" }]),
    ...(receivesTickets(role)
      ? [
          { key: "forwarded" as const, label: "Encaminhados a mim" },
          { key: "assigned" as const, label: "Atribuídos a mim" },
        ]
      : []),
    ...(dispatcher
      ? [
          { key: "unforwarded" as const, label: "Não encaminhados" },
          { key: "sent" as const, label: "Encaminhados por mim" },
        ]
      : []),
    { key: "mine", label: "Abertos por mim" },
  ];

  // com área padrão, "Todos os tipos" vira uma opção explícita (vazio voltaria ao padrão)
  const typeOptions = defaultType
    ? [{ value: ALL_TYPES, label: "Todas as áreas" }, ...toOptions(ticketTypeLabel)]
    : toOptions(ticketTypeLabel);
  // o summary ainda não traz "forwarded"; a coluna aparece quando o backend mandar
  const showForwarded = !!data?.items.some((t) => t.forwarded !== undefined);

  return (
    <>
      <PageHeader
        title="Chamados"
        description="Abra, acompanhe e atenda chamados de TI e Manutenção."
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
          <Select
            options={typeOptions}
            placeholder={defaultType ? undefined : "Todas as áreas"}
            value={filters.type}
            onChange={(e) => setFilter("type", e.target.value)}
          />
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
              { header: "Área", cell: (t) => ticketTypeLabel[t.ticketType] },
              { header: "Status", cell: (t) => <Badge tone={statusTone[t.status]}>{statusLabel[t.status]}</Badge> },
              { header: "Prioridade", cell: (t) => <Badge tone={priorityTone[t.priority]}>{priorityLabel[t.priority]}</Badge> },
              { header: "Unidade", cell: (t) => t.facility?.name },
              ...(showForwarded ? [{ header: "Encaminhado", cell: (t: TicketSummaryResponse) => t.forwarded?.username ?? "—" }] : []),
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
