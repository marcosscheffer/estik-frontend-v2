import { Link } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Bell, ChevronRight, Forward, Inbox, Monitor, Plus, Send, Ticket, UserCheck } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/contexts/AuthContext";
import { ticketsService } from "@/services/tickets";
import { computersService } from "@/services/computers";
import { notificationsService } from "@/services/notifications";
import { access } from "@/lib/roles";
import { accents, type AccentName } from "@/lib/accents";
import { statusLabel } from "@/lib/labels";
import { Card, CardGrid, CardHeader, EmptyState } from "@/components/ui";
import { TicketCard } from "./tickets/TicketCard";
import { TicketsByMonthChart } from "./dashboard/TicketsByMonthChart";
import type { TicketStatus } from "@/types/api";

const statuses = Object.keys(statusLabel) as TicketStatus[];
/** Mesmas cores do StatusPill. */
const statusColor: Record<TicketStatus, string> = {
  OPEN: "bg-slate-400",
  FORWARDED: "bg-violet-500",
  PROGRESS: "bg-sky-500",
  RESOLVED: "bg-emerald-500",
  CANCELLED: "bg-rose-500",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</h2>;
}

/** Indicador clicável: ícone, número grande e rótulo. Fundo sólido, sem brilho. */
function Stat({
  label,
  value,
  icon: Icon,
  to,
  accent,
  hint,
  compact,
}: {
  label: string;
  value?: number;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  accent: AccentName;
  hint?: string;
  /** versão em linha (ícone à esquerda), para a coluna lateral */
  compact?: boolean;
}) {
  const a = accents[accent];
  if (compact)
    return (
      <Link
        to={to}
        title={hint}
        className="group flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 ring-1 ring-slate-800 transition hover:bg-slate-800/70 hover:ring-slate-700"
      >
        <span className={clsx("flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset", a.chip)}>
          <Icon className="size-[18px]" />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm text-slate-400">{label}</p>
        <p className="text-xl font-semibold tabular-nums text-slate-100">{value ?? "—"}</p>
        <ChevronRight className="size-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-400" />
      </Link>
    );
  return (
    <Link
      to={to}
      title={hint}
      className="group flex flex-col gap-3 rounded-xl bg-slate-900 p-4 ring-1 ring-slate-800 transition hover:bg-slate-800/70 hover:ring-slate-700"
    >
      <div className="flex items-center justify-between">
        <span className={clsx("flex size-9 items-center justify-center rounded-lg ring-1 ring-inset", a.chip)}>
          <Icon className="size-[18px]" />
        </span>
        <ChevronRight className="size-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-400" />
      </div>
      <div>
        <p className="text-2xl font-semibold leading-none tabular-nums text-slate-100">{value ?? "—"}</p>
        <p className="mt-1.5 text-sm leading-snug text-slate-400">{label}</p>
      </div>
    </Link>
  );
}

export function DashboardPage() {
  const { claims, can } = useAuth();
  const me = claims!.sub;
  const isStaff = can(access.receiveTickets);
  const canForward = can(access.forwardTickets);
  const receiver = can(access.receiveTickets);

  const myTickets = useQuery({
    queryKey: ["tickets", "list", { requesterId: me, page: 0, size: 6 }],
    queryFn: () => ticketsService.list({ requesterId: me, page: 0, size: 6 }),
  });
  // técnico/admin vê os chamados mais recentes de todos
  const recent = useQuery({
    queryKey: ["tickets", "list", { page: 0, size: 6 }],
    queryFn: () => ticketsService.list({ page: 0, size: 6 }),
    enabled: isStaff,
  });
  // abertos = ainda não encaminhados (fila de triagem, todas as áreas)
  const triageQuery = { status: "OPEN" as const, size: 1 };
  const triage = useQuery({
    queryKey: ["tickets", "list", triageQuery],
    queryFn: () => ticketsService.list(triageQuery),
    enabled: canForward,
  });
  const sent = useQuery({
    queryKey: ["tickets", "list", { regulatorId: me, size: 1 }],
    queryFn: () => ticketsService.list({ regulatorId: me, size: 1 }),
    enabled: canForward,
  });
  // encaminhados a mim que ainda não assumi
  const forwarded = useQuery({
    queryKey: ["tickets", "list", { forwardedId: me, status: "FORWARDED", size: 1 }],
    queryFn: () => ticketsService.list({ forwardedId: me, status: "FORWARDED", size: 1 }),
    enabled: receiver,
  });
  const assigned = useQuery({
    queryKey: ["tickets", "list", { assigneeId: me, status: "PROGRESS", size: 1 }],
    queryFn: () => ticketsService.list({ assigneeId: me, status: "PROGRESS", size: 1 }),
    enabled: receiver,
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

  const counts = statuses.map((s, i) => ({ status: s, n: byStatus[i].data?.totalItems }));
  const total = counts.reduce((sum, c) => sum + (c.n ?? 0), 0);

  // indicadores de chamados, na ordem do fluxo de quem atende
  const work = [
    { label: "Meus chamados", value: myTickets.data?.totalItems, icon: Ticket, to: "/tickets?scope=mine", accent: "blue" as const, show: true },
    { label: "Para triagem", value: triage.data?.totalItems, icon: Inbox, to: "/tickets?scope=triage", accent: "violet" as const, show: canForward, hint: "Abertos esperando encaminhamento" },
    { label: "Encaminhados pra mim", value: forwarded.data?.totalItems, icon: Send, to: "/tickets?scope=forwarded&status=FORWARDED", accent: "teal" as const, show: receiver, hint: "Esperando você assumir" },
    { label: "Em atendimento por mim", value: assigned.data?.totalItems, icon: UserCheck, to: "/tickets?scope=assigned&status=PROGRESS", accent: "amber" as const, show: receiver },
    { label: "Encaminhados por mim", value: sent.data?.totalItems, icon: Forward, to: "/tickets?scope=sent", accent: "emerald" as const, show: canForward },
  ].filter((s) => s.show);

  const recentList = isStaff ? recent : myTickets;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Olá, {claims?.username}</h1>
          <p className="mt-1 text-sm text-slate-500">Um resumo do que está acontecendo.</p>
        </div>
        <Link
          to="/tickets?new=1"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-500"
        >
          <Plus className="size-4" /> Abrir chamado
        </Link>
      </div>

      <section>
        <SectionTitle>Seus chamados</SectionTitle>
        <div className={clsx("grid gap-3 sm:grid-cols-2", work.length >= 5 ? "xl:grid-cols-5" : work.length === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
          {work.map(({ show: _s, ...s }) => (
            <Stat key={s.label} {...s} />
          ))}
        </div>
      </section>

      <section className={clsx("grid gap-3", isStaff && "lg:grid-cols-3")}>
        {/* status + atalhos de inventário/notificações */}
        {isStaff && (
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-baseline justify-between gap-3">
              <SectionTitle>Chamados por status</SectionTitle>
              <span className="text-xs text-slate-500">{total} no total</span>
            </div>
            {/* barra única com a proporção de cada status */}
            <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-800" aria-hidden>
              {total > 0 &&
                counts.map((c) =>
                  c.n ? <span key={c.status} className={statusColor[c.status]} style={{ width: `${(c.n / total) * 100}%` }} /> : null,
                )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {counts.map((c) => (
                <Link
                  key={c.status}
                  to={`/tickets?scope=all&status=${c.status}`}
                  className="rounded-lg px-3 py-2 transition hover:bg-slate-800/70"
                >
                  <p className="flex items-center gap-2 text-xs text-slate-400">
                    <span className={clsx("size-2 rounded-full", statusColor[c.status])} />
                    {statusLabel[c.status]}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-slate-100">{c.n ?? "—"}</p>
                </Link>
              ))}
            </div>
          </Card>
        )}
        <div className={clsx("grid gap-3", isStaff ? "content-center sm:grid-cols-2 lg:grid-cols-1" : "sm:grid-cols-2")}>
          {can(access.computers) && (
            <Stat compact label="Computadores" value={computers.data?.totalItems} icon={Monitor} to="/computers" accent="cyan" />
          )}
          <Stat compact label="Notificações não lidas" value={unread.data?.quantity} icon={Bell} to="/notifications" accent="orange" />
        </div>
      </section>

      <TicketsByMonthChart />

      <Card>
        <CardHeader
          title={isStaff ? "Chamados recentes" : "Meus chamados recentes"}
          actions={
            <Link to={isStaff ? "/tickets?scope=all" : "/tickets?scope=mine"} className="text-sm font-medium text-brand-400 hover:text-brand-300">
              Ver todos
            </Link>
          }
        />
        <CardGrid
          rows={recentList.data?.items}
          loading={recentList.isLoading}
          rowKey={(t) => t.id}
          empty={
            <EmptyState
              icon={<Ticket className="size-5" />}
              title={isStaff ? "Nenhum chamado ainda" : "Você ainda não abriu chamados"}
              message={isStaff ? "Quando alguém abrir um chamado, ele aparece aqui." : "Precisa de ajuda com TI ou manutenção? Abra um chamado."}
            />
          }
          renderCard={(t) => <TicketCard ticket={t} />}
        />
      </Card>
    </div>
  );
}
