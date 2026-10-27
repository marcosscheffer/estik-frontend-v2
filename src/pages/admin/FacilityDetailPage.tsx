import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Monitor, Network, Pencil, Ticket, Trash2, Users } from "lucide-react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { mapQueries } from "@/hooks/useMapQueries";
import { facilitiesService } from "@/services/facilities";
import { computersService } from "@/services/computers";
import { ticketsService, type TicketFilters } from "@/services/tickets";
import { usersService } from "@/services/users";
import { formatNumber } from "@/lib/format";
import { statusLabel } from "@/lib/labels";
import {
  Badge,
  Card,
  CardGrid,
  ConfirmDialog,
  ErrorState,
  PageHeader,
  PageLoader,
  Pagination,
  Tabs,
  Tile,
  TileIcon,
  Button,
} from "@/components/ui";
import { TicketCard } from "@/pages/tickets/TicketCard";
import { UserCard } from "@/pages/users/UserCard";
import type { DepartamentSummaryResponse, TicketStatus } from "@/types/api";
import { FacilityModal } from "./FacilitiesPage";

type Tab = "departaments" | "tickets" | "users";
const tabs: { key: Tab; label: string }[] = [
  { key: "departaments", label: "Departamentos" },
  { key: "tickets", label: "Chamados" },
  { key: "users", label: "Usuários" },
];

type StatusFilter = "" | TicketStatus;
const statusTabs: { key: StatusFilter; label: string }[] = [
  { key: "", label: "Todos" },
  ...(Object.keys(statusLabel) as TicketStatus[]).map((s) => ({ key: s, label: statusLabel[s] })),
];

function Summary({ label, value, icon }: { label: string; value?: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <TileIcon icon={icon} />
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-semibold tabular-nums text-slate-100">{value == null ? "—" : formatNumber(value)}</p>
      </div>
    </Card>
  );
}

/** Card de departamento com os contadores de computadores e itens. */
function DepartamentCard({ dep }: { dep: DepartamentSummaryResponse }) {
  const navigate = useNavigate();
  const computers = useQuery(mapQueries.computerCount(dep.id));
  const items = useQuery(mapQueries.balanceCount(dep.id));
  return (
    <Tile onClick={() => navigate(`/departaments/${dep.id}`)}>
      <div className="flex items-start gap-3">
        <TileIcon icon={Network} className="bg-violet-500/15 text-violet-400" />
        <div className="min-w-0">
          <h3 className="truncate font-medium text-slate-100">{dep.name}</h3>
          <Badge tone="blue">{dep.code}</Badge>
        </div>
      </div>
      <div className="mt-auto flex gap-4 text-sm text-slate-400">
        <span><span className="font-semibold tabular-nums text-slate-200">{computers.data?.totalItems ?? "—"}</span> computadores</span>
        <span><span className="font-semibold tabular-nums text-slate-200">{items.data?.totalItems ?? "—"}</span> itens</span>
      </div>
    </Tile>
  );
}

export function FacilityDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [modal, setModal] = useState<null | "edit" | "delete">(null);

  const tab = (tabs.some((t) => t.key === params.get("tab")) ? params.get("tab") : "departaments") as Tab;
  const status = (params.get("status") ?? "") as StatusFilter;
  const page = Number(params.get("page") ?? 0);

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next;
      },
      { replace: true },
    );

  const { data: facility, isLoading, error } = useQuery({
    queryKey: ["facilities", "detail", id],
    queryFn: () => facilitiesService.get(id),
  });

  // 100 é o máximo por página; uma unidade costuma ter bem menos departamentos
  const deps = useQuery(mapQueries.departaments(id));
  const computerCount = useQuery({
    queryKey: ["computers", "list", { facilityId: id, size: 1 }],
    queryFn: () => computersService.list({ facilityId: id, size: 1 }),
  });
  const ticketCount = useQuery({
    queryKey: ["tickets", "list", { facilityId: id, size: 1 }],
    queryFn: () => ticketsService.list({ facilityId: id, size: 1 }),
  });

  const ticketQuery: TicketFilters = { facilityId: id, page, size: 12, ...(status ? { status } : {}) };
  const tickets = useQuery({
    queryKey: ["tickets", "list", ticketQuery],
    queryFn: () => ticketsService.list(ticketQuery),
    placeholderData: keepPreviousData,
    enabled: tab === "tickets",
  });

  // /users pagina com "content", não "items"
  const userCount = useQuery({
    queryKey: ["users", "list", { facilityId: id, size: 1 }],
    queryFn: () => usersService.list({ facilityId: id, size: 1 }),
  });
  const usersQuery = { facilityId: id, page, size: 12 };
  const users = useQuery({
    queryKey: ["users", "list", usersQuery],
    queryFn: () => usersService.list(usersQuery),
    placeholderData: keepPreviousData,
    enabled: tab === "users",
  });

  const remove = useApiMutation({
    mutationFn: () => facilitiesService.remove(id),
    invalidate: [["facilities"], ["lookup", "facilities"]],
    success: "Unidade excluída",
    onSuccess: () => navigate("/facilities"),
  });

  if (isLoading) return <PageLoader />;
  if (error || !facility) return <ErrorState error={error} />;

  return (
    <>
      <PageHeader
        back="/facilities"
        title={facility.name}
        description={`Código ${facility.code}`}
        actions={
          <>
            <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setModal("edit")}>Editar</Button>
            <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setModal("delete")} aria-label="Excluir" />
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Departamentos" value={deps.data?.totalItems} icon={Network} />
        <Summary label="Computadores" value={computerCount.data?.totalItems} icon={Monitor} />
        <Summary label="Chamados" value={ticketCount.data?.totalItems} icon={Ticket} />
        <Summary label="Usuários" value={userCount.data?.totalItems} icon={Users} />
      </div>

      <Tabs tabs={tabs} value={tab} onChange={(t) => update({ tab: t === "departaments" ? null : t, page: null, status: null })} />

      {tab === "departaments" ? (
        <Card>
          {deps.error ? (
            <div className="p-4"><ErrorState error={deps.error} /></div>
          ) : (
            <CardGrid
              rows={deps.data?.items}
              loading={deps.isLoading}
              rowKey={(d) => d.id}
              empty="Esta unidade ainda não tem departamentos."
              renderCard={(d) => <DepartamentCard dep={d} />}
            />
          )}
        </Card>
      ) : tab === "users" ? (
        <Card>
          {users.error ? (
            <div className="p-4"><ErrorState error={users.error} /></div>
          ) : (
            <CardGrid
              rows={users.data?.content}
              loading={users.isLoading || users.isFetching}
              rowKey={(u) => u.id}
              empty="Nenhum usuário nesta unidade."
              renderCard={(u) => <UserCard user={u} />}
            />
          )}
          {users.data && (
            <Pagination
              page={page}
              totalPages={users.data.totalPages}
              totalItems={users.data.totalItems}
              onChange={(p) => update({ page: p > 0 ? String(p) : null })}
            />
          )}
        </Card>
      ) : (
        <Card>
          <div className="border-b border-slate-800 px-4 pt-4">
            <Tabs tabs={statusTabs} value={status} onChange={(s) => update({ status: s || null, page: null })} />
          </div>
          {tickets.error ? (
            <div className="p-4"><ErrorState error={tickets.error} /></div>
          ) : (
            <CardGrid
              rows={tickets.data?.items}
              loading={tickets.isLoading || tickets.isFetching}
              rowKey={(t) => t.id}
              empty={status ? `Nenhum chamado "${statusLabel[status]}" nesta unidade.` : "Nenhum chamado nesta unidade."}
              renderCard={(t) => <TicketCard ticket={t} />}
            />
          )}
          {tickets.data && (
            <Pagination
              page={page}
              totalPages={tickets.data.totalPages}
              totalItems={tickets.data.totalItems}
              onChange={(p) => update({ page: p > 0 ? String(p) : null })}
            />
          )}
        </Card>
      )}

      <FacilityModal open={modal === "edit"} onClose={() => setModal(null)} facility={facility} />
      <ConfirmDialog
        open={modal === "delete"}
        title="Excluir unidade?"
        message={<>A unidade <strong>{facility.name}</strong> será excluída.</>}
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setModal(null)}
      />
    </>
  );
}
