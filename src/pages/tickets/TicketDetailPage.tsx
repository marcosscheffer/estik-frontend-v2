import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Ban, CheckCircle2, Clock, Hand, Hourglass, Pencil, RotateCcw, Send, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/contexts/AuthContext";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ticketsService, type TicketAction } from "@/services/tickets";
import { access } from "@/lib/permissions";
import { formatDateTime, formatRelative } from "@/lib/format";
import { priorityLabel, priorityTone, specializationName } from "@/lib/labels";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  ErrorState,
  PageHeader,
  PageLoader,
  StatusPill,
} from "@/components/ui";
import { TicketFormModal } from "./TicketFormModal";
import { ForwardTicketModal } from "./ForwardTicketModal";
import { TicketChat } from "./TicketChat";

const actionText: Record<TicketAction, string> = {
  assume: "Chamado assumido",
  resolve: "Chamado resolvido",
  reopen: "Chamado reaberto",
  cancel: "Chamado cancelado",
};

export function TicketDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { claims, can } = useAuth();
  const me = claims!.sub;
  const [editOpen, setEditOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "cancel" | "delete">(null);

  const { data: ticket, isLoading, error } = useQuery({
    queryKey: ["tickets", "detail", id],
    queryFn: () => ticketsService.get(id),
  });
  const history = useQuery({
    queryKey: ["tickets", "histories", id],
    queryFn: () => ticketsService.histories(id, { size: 50 }),
  });

  const act = useApiMutation({
    mutationFn: (a: TicketAction) => ticketsService.action(id, a),
    invalidate: [["tickets"], ["notifications"]],
    success: (_d, a) => actionText[a],
    onSuccess: () => setConfirm(null),
  });
  const remove = useApiMutation({
    mutationFn: () => ticketsService.remove(id),
    invalidate: [["tickets"]],
    success: "Chamado excluído",
    onSuccess: () => navigate("/tickets"),
  });

  if (isLoading) return <PageLoader />;
  if (error || !ticket) return <ErrorState error={error} />;

  // Mesmas regras do domínio Ticket no backend, para só mostrar o que faz sentido.
  const forwardedUsers = (ticket.forwarded ?? []).map((f) => f.user).filter(Boolean);
  const assignees = (ticket.assigneeds ?? []).map((a) => a.user).filter(Boolean);
  const isRequester = ticket.requester?.id === me;
  const isAssignee = assignees.some((u) => u.id === me);
  const closed = ticket.status === "RESOLVED" || ticket.status === "CANCELLED";
  const isForwarded = forwardedUsers.some((u) => u.id === me);
  // equipe do chamado: quem foi encaminhado, marcando quem já assumiu (atendendo vem primeiro)
  const team = [
    ...forwardedUsers.map((u) => ({ user: u, working: assignees.some((a) => a.id === u.id) })),
    ...assignees.filter((a) => !forwardedUsers.some((u) => u.id === a.id)).map((u) => ({ user: u, working: true })),
  ].sort((a, b) => Number(b.working) - Number(a.working) || a.user.username.localeCompare(b.user.username));
  const workingCount = team.filter((t) => t.working).length;
  // Ticket.assign: quem está na lista de encaminhados e ainda não assumiu; vários podem assumir,
  // então vale também com o chamado já em andamento
  const canAssume =
    isForwarded && !isAssignee && !isRequester && ["FORWARDED", "REFORWARDED", "PROGRESS"].includes(ticket.status);
  // Ticket.forward/reforward: qualquer status menos resolvido ou cancelado
  const canForward = can(access.forwardTickets) && !closed;
  const canResolve = isAssignee && ticket.status === "PROGRESS";
  const canReopen = isRequester && ticket.status === "RESOLVED";
  const canCancel = isRequester && !closed;
  const canEdit = isRequester && !closed;

  const run = (a: TicketAction) => act.mutate(a);

  return (
    <>
      <PageHeader
        back="/tickets"
        title={ticket.title}
        actions={
          <>
            {canAssume && (
              <Button icon={<Hand className="size-4" />} loading={act.isPending && act.variables === "assume"} onClick={() => run("assume")}>
                Assumir
              </Button>
            )}
            {canForward && (
              <Button variant="secondary" icon={<Send className="size-4" />} onClick={() => setForwardOpen(true)}>
                {forwardedUsers.length ? "Reencaminhar" : "Encaminhar"}
              </Button>
            )}
            {canResolve && (
              <Button icon={<CheckCircle2 className="size-4" />} loading={act.isPending && act.variables === "resolve"} onClick={() => run("resolve")}>
                Resolver
              </Button>
            )}
            {canReopen && (
              <Button variant="secondary" icon={<RotateCcw className="size-4" />} loading={act.isPending && act.variables === "reopen"} onClick={() => run("reopen")}>
                Reabrir
              </Button>
            )}
            {canEdit && (
              <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditOpen(true)}>
                Editar
              </Button>
            )}
            {canCancel && (
              <Button variant="secondary" icon={<Ban className="size-4" />} onClick={() => setConfirm("cancel")}>
                Cancelar chamado
              </Button>
            )}
            {can(access.deleteTickets) && (
              <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setConfirm("delete")} aria-label="Excluir" />
            )}
          </>
        }
      />

      {/* desktop: detalhes + histórico à esquerda, conversa fixa à direita; celular: detalhes, conversa, histórico */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="contents lg:block lg:space-y-6">
        <Card>
          <div className="space-y-4 px-5 py-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <StatusPill status={ticket.status} size="md" />
              <span className="h-5 w-px bg-slate-800" aria-hidden />
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                Prioridade <Badge tone={priorityTone[ticket.priority]}>{priorityLabel[ticket.priority]}</Badge>
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                Área <Badge>{specializationName(ticket.specialization)}</Badge>
              </span>
            </div>
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Descrição</h3>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">
                {ticket.description || <span className="text-slate-500">Sem descrição</span>}
              </p>
            </div>
          </div>

          {/* pessoas envolvidas, na ordem do fluxo */}
          <div className="border-t border-slate-800 px-5 py-4">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {[
                { role: "Solicitante", user: ticket.requester },
                { role: "Encaminhado por", user: ticket.regulator },
              ].map(({ role, user }) => (
                <div key={role} className="min-w-0">
                  <dt className="text-xs text-slate-500">{role}</dt>
                  <dd className={clsx("mt-0.5 flex items-center gap-2 text-sm", user ? "text-slate-100" : "text-slate-500")}>
                    <span className="truncate">{user ? user.username : "—"}</span>
                    {user?.id === me && <span className="shrink-0 text-xs text-slate-500">(você)</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* equipe: cada pessoa encaminhada em um cartão, com o estado dela */}
          <div className="border-t border-slate-800 px-5 py-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Equipe</h3>
              {team.length > 0 && (
                <span className="text-xs text-slate-500">
                  <span className="text-sky-300">{workingCount} atendendo</span>
                  {" · "}
                  <span className="text-violet-300">{team.length - workingCount} aguardando</span>
                </span>
              )}
            </div>
            {team.length === 0 ? (
              <p className="text-sm text-slate-500">Ainda não foi encaminhado para ninguém.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {team.map(({ user, working }) => (
                  <li
                    key={user.id}
                    className={clsx(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 ring-1 ring-inset",
                      working ? "bg-sky-950/40 ring-sky-900" : "bg-slate-900/60 ring-slate-800",
                    )}
                  >
                    <span
                      className={clsx(
                        "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold uppercase",
                        working ? "bg-sky-500/20 text-sky-200" : "bg-violet-500/15 text-violet-200",
                      )}
                      aria-hidden
                    >
                      {user.username.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-slate-100">{user.username}</span>
                        {user.id === me && <span className="shrink-0 text-xs text-slate-500">(você)</span>}
                      </span>
                      <span className={clsx("mt-0.5 flex items-center gap-1 text-xs", working ? "text-sky-300" : "text-violet-300")}>
                        {working ? <Clock className="size-3.5" aria-hidden /> : <Hourglass className="size-3.5" aria-hidden />}
                        {working ? "Atendendo" : "Aguardando assumir"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <dl className="grid gap-x-6 gap-y-3 border-t border-slate-800 px-5 py-4 sm:grid-cols-3">
            {[
              { label: "Unidade", value: ticket.facility ? `${ticket.facility.name} (${ticket.facility.code})` : "—" },
              { label: "Aberto em", value: formatDateTime(ticket.createdAt) },
              { label: "Atualizado", value: formatRelative(ticket.updatedAt), title: formatDateTime(ticket.updatedAt) },
            ].map(({ label, value, title }) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="mt-0.5 truncate text-sm text-slate-100" title={title}>{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="order-3 lg:order-none">
          <CardHeader title="Histórico" />
          <div className="px-5 py-4">
            {history.data?.items.length === 0 && <p className="text-sm text-slate-500">Sem histórico ainda.</p>}
            {history.error && <ErrorState error={history.error} />}
            <ol className="relative">
              {history.data?.items.map((h, i, all) => (
                <li key={h.id} className="relative flex gap-4 pb-5 last:pb-0">
                  {/* linha ligando os eventos */}
                  {i < all.length - 1 && <span className="absolute left-[7px] top-5 h-full w-px bg-slate-800" aria-hidden />}
                  <span className="relative mt-1.5 size-[15px] shrink-0 rounded-full border-2 border-slate-900 bg-slate-600 ring-1 ring-slate-700" />
                  <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <StatusPill status={h.status} />
                    <span className="text-xs text-slate-500" title={formatDateTime(h.createdAt)}>
                      {formatDateTime(h.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Card>
        </div>

        <TicketChat
          ticket={ticket}
          me={me}
          fill
          supervise={can(access.superviseChats)}
          events={history.data?.items}
          className="order-2 h-[70vh] min-h-[420px] lg:sticky lg:top-20 lg:h-[calc(100vh-7.5rem)] lg:min-h-[520px]"
        />
      </div>

      <TicketFormModal open={editOpen} onClose={() => setEditOpen(false)} ticket={ticket} />
      {canForward && <ForwardTicketModal open={forwardOpen} onClose={() => setForwardOpen(false)} ticket={ticket} />}

      <ConfirmDialog
        open={confirm === "cancel"}
        title="Cancelar chamado?"
        message="O chamado será encerrado como cancelado e não poderá ser reaberto."
        confirmLabel="Cancelar chamado"
        danger
        loading={act.isPending}
        onConfirm={() => run("cancel")}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title="Excluir chamado?"
        message="Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
