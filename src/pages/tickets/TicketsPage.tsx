import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FilterX, Inbox, Plus, SearchX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFilters } from "@/hooks/useFilters";
import { ticketsService, type TicketFilters } from "@/services/tickets";
import { access } from "@/lib/roles";
import { formatDateTime, formatRelative } from "@/lib/format";
import { priorityLabel, priorityTone, statusLabel, ticketTypeLabel, toOptions } from "@/lib/labels";
import { useViewMode } from "@/hooks/useViewMode";
import { Badge, Button, Card, CardGrid, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Select, StatusPill, Table, Tabs, ViewToggle } from "@/components/ui";
import { FacilitySelect } from "@/components/LookupSelects";
import { TicketFormModal } from "./TicketFormModal";
import { TicketCard } from "./TicketCard";
import type { TicketPriority, TicketStatus, TicketType } from "@/types/api";

/**
 * Abas da lista. Cada uma vira um filtro do GET /tickets:
 * - mine: requesterId = eu
 * - triage: status OPEN (ainda não encaminhado), de todas as áreas (dá para filtrar pela área)
 * - forwarded: forwardedId = eu (para assumir)
 * - assigned: assigneeId = eu (em atendimento)
 * - sent: regulatorId = eu (que eu encaminhei)
 */
type Scope = "all" | "mine" | "triage" | "forwarded" | "assigned" | "sent";
const SCOPES: Scope[] = ["all", "mine", "triage", "forwarded", "assigned", "sent"];

export function TicketsPage() {
  const { claims, can } = useAuth();
  const me = claims!.sub;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [view, setView] = useViewMode("tickets");
  // técnico+ vê todos os chamados; triagem/encaminhados por mim são de quem encaminha (admin)
  const isStaff = can(access.receiveTickets);
  const canForward = can(access.forwardTickets);
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

  const tabs: { key: Scope; label: string; count?: number }[] = [
    ...(isStaff ? [{ key: "all" as const, label: "Todos" }] : []),
    { key: "mine", label: "Meus chamados" },
    ...(canForward ? [{ key: "triage" as const, label: "Para triagem" }] : []),
    ...(receiver
      ? [
          { key: "forwarded" as const, label: "Encaminhados pra mim" },
          { key: "assigned" as const, label: "Em atendimento por mim" },
        ]
      : []),
    ...(canForward ? [{ key: "sent" as const, label: "Encaminhados por mim" }] : []),
  ];
  const urlScope = SCOPES.includes(filters.scope as Scope) ? (filters.scope as Scope) : undefined;
  // sem escopo (ou um que o papel não tem): staff cai em "Todos", usuário em "Meus chamados"
  const scope: Scope = urlScope && tabs.some((t) => t.key === urlScope) ? urlScope : isStaff ? "all" : "mine";

  const query: TicketFilters = {
    title: filters.title || undefined,
    status: scope === "triage" ? "OPEN" : (filters.status as TicketStatus) || undefined,
    priority: (filters.priority as TicketPriority) || undefined,
    type: (filters.type as TicketType) || undefined,
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
  });

  // total só na aba aberta (vem da própria busca; contar as outras exigiria mais requisições)
  const tabsWithCount = tabs.map((t) => (t.key === scope && data ? { ...t, count: data.totalItems } : t));

  const hasFilters = !!(filters.title || filters.priority || filters.type || filters.facilityId || (scope !== "triage" && filters.status));
  const clearFilters = () => {
    const next = new URLSearchParams();
    if (filters.scope) next.set("scope", filters.scope);
    setParams(next, { replace: true });
  };

  /** Vazio: com filtro é "nada encontrado"; sem filtro, uma mensagem própria de cada aba. */
  const emptyByScope: Record<Scope, { title: string; message: string }> = {
    all: { title: "Nenhum chamado ainda", message: "Quando alguém abrir um chamado, ele aparece aqui." },
    mine: { title: "Você ainda não abriu chamados", message: "Precisa de ajuda com TI ou manutenção? Abra um chamado." },
    triage: { title: "Triagem em dia", message: "Nenhum chamado aberto esperando encaminhamento." },
    forwarded: { title: "Nada encaminhado para você", message: "Os chamados que encaminharem para você aparecem aqui para assumir." },
    assigned: { title: "Nenhum chamado em atendimento", message: "Os chamados que você assumir aparecem aqui." },
    sent: { title: "Você ainda não encaminhou chamados", message: "Os chamados que você encaminhar aparecem aqui." },
  };
  const empty = hasFilters ? (
    <EmptyState
      icon={<SearchX className="size-5" />}
      title="Nenhum chamado encontrado"
      message="Nenhum chamado bate com esses filtros."
      action={<Button size="sm" variant="secondary" icon={<FilterX className="size-4" />} onClick={clearFilters}>Limpar filtros</Button>}
    />
  ) : (
    <EmptyState
      icon={<Inbox className="size-5" />}
      {...emptyByScope[scope]}
      action={scope === "mine" ? <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setFormOpen(true)}>Abrir chamado</Button> : undefined}
    />
  );

  const setScope = (s: Scope) => {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (s === "triage") next.delete("status");
    next.set("scope", s);
    setParams(next, { replace: true });
  };

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

      <Tabs tabs={tabsWithCount} value={scope} onChange={setScope} />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 p-4">
          <div className="w-full min-w-56 flex-1">
            <SearchInput value={filters.title} onChange={(v) => setFilter("title", v)} placeholder="Buscar por título" />
          </div>
          <Select
            className="w-full sm:w-44"
            options={toOptions(statusLabel)}
            placeholder="Todos os status"
            value={scope === "triage" ? "OPEN" : filters.status}
            disabled={scope === "triage"}
            title={scope === "triage" ? "A triagem mostra só os chamados abertos" : undefined}
            onChange={(e) => setFilter("status", e.target.value)}
          />
          <Select className="w-full sm:w-48" options={toOptions(priorityLabel)} placeholder="Todas as prioridades" value={filters.priority} onChange={(e) => setFilter("priority", e.target.value)} />
          <Select className="w-full sm:w-44" options={toOptions(ticketTypeLabel)} placeholder="Todas as áreas" value={filters.type} onChange={(e) => setFilter("type", e.target.value)} />
          <FacilitySelect className="w-full sm:w-48" placeholder="Todas as unidades" value={filters.facilityId} onChange={(e) => setFilter("facilityId", e.target.value)} />
          {hasFilters && (
            <Button variant="ghost" icon={<FilterX className="size-4" />} onClick={clearFilters}>
              Limpar
            </Button>
          )}
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
            empty={empty}
            renderCard={(t) => <TicketCard ticket={t} />}
          />
        ) : (
          <Table
            rows={data?.items}
            loading={isLoading || isFetching}
            rowKey={(t) => t.id}
            empty={empty}
            onRowClick={(t) => navigate(`/tickets/${t.id}`)}
            columns={[
              {
                header: "Título",
                className: "w-full max-w-0",
                cell: (t) => (
                  <span
                    className={clsx("block truncate font-medium", t.status === "CANCELLED" || t.status === "RESOLVED" ? "text-slate-400" : "text-slate-100")}
                    title={t.title}
                  >
                    {t.title}
                  </span>
                ),
              },
              { header: "Status", cell: (t) => <StatusPill status={t.status} /> },
              { header: "Prioridade", cell: (t) => <Badge tone={priorityTone[t.priority]}>{priorityLabel[t.priority]}</Badge> },
              { header: "Área", cell: (t) => <Badge>{ticketTypeLabel[t.ticketType]}</Badge> },
              { header: "Unidade", cell: (t) => <span className="text-slate-400">{t.facility?.name ?? "—"}</span> },
              {
                header: "Aberto",
                cell: (t) => <span className="text-slate-400" title={formatDateTime(t.createdAt)}>{formatRelative(t.createdAt)}</span>,
              },
            ]}
          />
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} totalItems={data.totalItems} onChange={setPage} />}
      </Card>

      <TicketFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </>
  );
}
