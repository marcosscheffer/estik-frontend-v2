import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFilters } from "@/hooks/useFilters";
import { ticketsService, type TicketFilters } from "@/services/tickets";
import { access, ticketTypeOf } from "@/lib/roles";
import { formatDateTime } from "@/lib/format";
import { priorityLabel, priorityTone, statusLabel, statusTone, ticketTypeLabel, toOptions } from "@/lib/labels";
import { useViewMode } from "@/hooks/useViewMode";
import { Badge, Button, Card, CardGrid, ErrorState, PageHeader, Pagination, SearchInput, Select, Table, Tabs, ViewToggle } from "@/components/ui";
import { FacilitySelect } from "@/components/LookupSelects";
import { TicketFormModal } from "./TicketFormModal";
import { TicketCard } from "./TicketCard";
import type { TicketPriority, TicketStatus, TicketType } from "@/types/api";

/**
 * Abas da lista. Cada uma vira um filtro do GET /tickets:
 * - mine: requesterId = eu
 * - triage: status OPEN (ainda não encaminhado), na área da minha função
 * - forwarded: forwardedId = eu (para assumir)
 * - assigned: assigneeId = eu (em atendimento)
 * - sent: regulatorId = eu (que eu encaminhei)
 */
type Scope = "all" | "mine" | "triage" | "forwarded" | "assigned" | "sent";
const SCOPES: Scope[] = ["all", "mine", "triage", "forwarded", "assigned", "sent"];

/** Valor na URL para "todas as áreas" quando o padrão do filtro é a área do usuário. */
const ALL_TYPES = "ALL";

export function TicketsPage() {
  const { claims, me: user, can } = useAuth();
  const me = claims!.sub;
  const [params, setParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [view, setView] = useViewMode("tickets");
  const isStaff = can(access.forwardTickets);
  const receiver = can(access.receiveTickets);

  const { filters, page, setFilter, setPage } = useFilters({
    scope: "",
    title: "",
    status: "",
    priority: "",
    type: "",
    facilityId: "",
  });

  // /tickets?new=1 abre o formulário direto (link do dashboard).
  useEffect(() => {
    if (params.get("new")) {
      setFormOpen(true);
      params.delete("new");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const tabs: { key: Scope; label: string }[] = [
    ...(isStaff ? [{ key: "all" as const, label: "Todos" }] : []),
    { key: "mine", label: "Meus chamados" },
    ...(isStaff ? [{ key: "triage" as const, label: "Para triagem" }] : []),
    ...(receiver
      ? [
          { key: "forwarded" as const, label: "Encaminhados pra mim" },
          { key: "assigned" as const, label: "Em atendimento por mim" },
        ]
      : []),
    ...(isStaff ? [{ key: "sent" as const, label: "Encaminhados por mim" }] : []),
  ];
  const urlScope = SCOPES.includes(filters.scope as Scope) ? (filters.scope as Scope) : undefined;
  // sem escopo (ou um que o papel não tem): staff cai em "Todos", usuário em "Meus chamados"
  const scope: Scope = urlScope && tabs.some((t) => t.key === urlScope) ? urlScope : isStaff ? "all" : "mine";

  // Na triagem o padrão é a área da minha função (TI/Manutenção); dá para trocar.
  const defaultType = scope === "triage" ? ticketTypeOf(user?.function) ?? "" : "";
  const type = filters.type || defaultType;

  const query: TicketFilters = {
    title: filters.title || undefined,
    status: scope === "triage" ? "OPEN" : (filters.status as TicketStatus) || undefined,
    priority: (filters.priority as TicketPriority) || undefined,
    type: type && type !== ALL_TYPES ? (type as TicketType) : undefined,
    facilityId: filters.facilityId || undefined,
    ...(scope === "mine" ? { requesterId: me } : {}),
    ...(scope === "forwarded" ? { forwardedId: me } : {}),
    ...(scope === "assigned" ? { assigneeId: me } : {}),
    ...(scope === "sent" ? { regulatorId: me } : {}),
    page,
    size: 20,
  };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["tickets", "list", query],
    queryFn: () => ticketsService.list(query),
    placeholderData: keepPreviousData,
    // na triagem espera o perfil (função) para não buscar sem o filtro de área e logo depois com ele
    enabled: scope !== "triage" || !!user,
  });

  const setScope = (s: Scope) => {
    const next = new URLSearchParams(params);
    next.delete("page");
    next.delete("type");
    if (s === "triage") next.delete("status");
    next.set("scope", s);
    setParams(next, { replace: true });
  };

  // com área padrão, "Todas as áreas" vira uma opção explícita (vazio voltaria ao padrão)
  const typeOptions = defaultType
    ? [{ value: ALL_TYPES, label: "Todas as áreas" }, ...toOptions(ticketTypeLabel)]
    : toOptions(ticketTypeLabel);

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
          <Select
            options={toOptions(statusLabel)}
            placeholder="Todos os status"
            value={scope === "triage" ? "OPEN" : filters.status}
            disabled={scope === "triage"}
            title={scope === "triage" ? "A triagem mostra só os chamados abertos" : undefined}
            onChange={(e) => setFilter("status", e.target.value)}
          />
          <Select options={toOptions(priorityLabel)} placeholder="Todas as prioridades" value={filters.priority} onChange={(e) => setFilter("priority", e.target.value)} />
          <Select
            options={typeOptions}
            placeholder={defaultType ? undefined : "Todas as áreas"}
            value={type}
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
