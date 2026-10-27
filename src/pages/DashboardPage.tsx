import { Link } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Bell, Monitor, Ticket, UserCheck } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/contexts/AuthContext";
import { ticketsService } from "@/services/tickets";
import { computersService } from "@/services/computers";
import { notificationsService } from "@/services/notifications";
import { access } from "@/lib/roles";
import { accents, type AccentName } from "@/lib/accents";
import { statusLabel } from "@/lib/labels";
import { Card, CardGrid, CardHeader } from "@/components/ui";
import { TicketCard } from "./tickets/TicketCard";
import { TicketsByMonthChart } from "./dashboard/TicketsByMonthChart";
import type { TicketStatus } from "@/types/api";

const statuses = Object.keys(statusLabel) as TicketStatus[];
const statusDot: Record<TicketStatus, string> = {
  OPEN: "bg-blue-500",
  PROGRESS: "bg-amber-500",
  RESOLVED: "bg-emerald-500",
  CANCELLED: "bg-slate-500",
};

function Stat({
  label,
  value,
  icon: Icon,
  to,
  accent,
}: {
  label: string;
  value?: number;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  accent: AccentName;
}) {
  const a = accents[accent];
  return (
    <Link to={to} className="group">
      <Card className={clsx("relative overflow-hidden bg-gradient-to-br to-transparent p-5 transition group-hover:-translate-y-0.5 group-hover:ring-white/15", a.soft)}>
        {/* linha colorida no topo do card */}
        <span className={clsx("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r to-transparent", a.bar)} aria-hidden />
        <div className="flex items-center gap-4">
          <span className={clsx("flex size-11 items-center justify-center rounded-lg ring-1 ring-inset", a.chip)}>
            <Icon className="size-5" />
          </span>
          <div>
            <p className="text-sm text-slate-400">{label}</p>
            <p className="text-2xl font-semibold tabular-nums text-slate-100">{value ?? "—"}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function DashboardPage() {
  const { claims, can } = useAuth();
  const me = claims!.sub;
  const isStaff = can(access.assumeTickets);

  const myTickets = useQuery({
    queryKey: ["tickets", "list", { requesterId: me, page: 0, size: 5 }],
    queryFn: () => ticketsService.list({ requesterId: me, page: 0, size: 5 }),
  });
  const openTickets = useQuery({
    queryKey: ["tickets", "list", { status: "OPEN", size: 1 }],
    queryFn: () => ticketsService.list({ status: "OPEN", size: 1 }),
    enabled: isStaff,
  });
  const assigned = useQuery({
    queryKey: ["tickets", "list", { assigneeId: me, status: "PROGRESS", size: 1 }],
    queryFn: () => ticketsService.list({ assigneeId: me, status: "PROGRESS", size: 1 }),
    enabled: isStaff,
  });
  const computers = useQuery({
    queryKey: ["computers", "list", { size: 1 }],
    queryFn: () => computersService.list({ size: 1 }),
    enabled: can(access.computers),
  });
  const byStatus = useQueries({
    queries: statuses.map((status) => ({
      queryKey: ["tickets", "list", { status, size: 1 }],
      queryFn: () => ticketsService.list({ status, size: 1 }),
      enabled: isStaff,
    })),
  });
  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: notificationsService.unread,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
          Olá,{" "}
          <span className="bg-gradient-to-r from-brand-300 to-violet-300 bg-clip-text text-transparent">{claims?.username}</span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">Um resumo do que está acontecendo.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Meus chamados" value={myTickets.data?.totalItems} icon={Ticket} to={`/tickets?requesterId=${me}`} accent="blue" />
        {isStaff && (
          <>
            <Stat label="Chamados abertos" value={openTickets.data?.totalItems} icon={Ticket} to="/tickets?status=OPEN" accent="violet" />
            <Stat
              label="Atribuídos a mim"
              value={assigned.data?.totalItems}
              icon={UserCheck}
              to={`/tickets?assigneeId=${me}&status=PROGRESS`}
              accent="amber"
            />
          </>
        )}
        {can(access.computers) && (
          <Stat label="Computadores" value={computers.data?.totalItems} icon={Monitor} to="/computers" accent="cyan" />
        )}
        <Stat label="Notificações não lidas" value={unread.data?.quantity} icon={Bell} to="/notifications" accent="orange" />
      </div>

      {isStaff && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Chamados por status</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {statuses.map((status, i) => (
              <Link
                key={status}
                to={`/tickets?status=${status}`}
                className="rounded-xl bg-slate-800/50 p-4 ring-1 ring-white/[0.06] transition hover:-translate-y-0.5 hover:bg-slate-800/80 hover:ring-white/15"
              >
                <p className="flex items-center gap-2 text-sm text-slate-400">
                  <span className={clsx("size-2 rounded-full", statusDot[status])} />
                  {statusLabel[status]}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-100">
                  {byStatus[i].data?.totalItems ?? "—"}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <TicketsByMonthChart />

      <Card>
        <CardHeader
          title="Meus chamados recentes"
          actions={
            <Link to="/tickets?new=1" className="text-sm font-medium text-brand-400 hover:text-brand-300">
              Abrir chamado
            </Link>
          }
        />
        <CardGrid
          rows={myTickets.data?.items}
          loading={myTickets.isLoading}
          rowKey={(t) => t.id}
          empty="Você ainda não abriu chamados."
          renderCard={(t) => <TicketCard ticket={t} />}
        />
      </Card>
    </div>
  );
}
