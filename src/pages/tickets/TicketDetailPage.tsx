import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Ban, CheckCircle2, Hand, Pencil, RotateCcw, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ticketsService, type TicketAction } from "@/services/tickets";
import { access } from "@/lib/roles";
import { formatDateTime } from "@/lib/format";
import { priorityLabel, priorityTone, statusLabel, statusTone, ticketTypeLabel } from "@/lib/labels";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DetailList,
  ErrorState,
  PageHeader,
  PageLoader,
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
  const isRequester = ticket.requester?.id === me;
  const isAssignee = ticket.assignee?.id === me;
  const closed = ticket.status === "RESOLVED" || ticket.status === "CANCELLED";
  const isForwarded = ticket.forwarded?.id === me;
  // Ticket.assignTo: só quem recebeu o encaminhamento, não o solicitante, sem responsável ainda
  const canAssume = isForwarded && !isRequester && !ticket.assignee && ticket.status === "FORWARDED";
  // Ticket.forward aceita OPEN ou FORWARDED; a rota exige REGULATOR+
  const canForward = can(access.forwardTickets) && (ticket.status === "OPEN" || ticket.status === "FORWARDED");
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
                {ticket.forwarded ? "Reencaminhar" : "Encaminhar"}
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

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Detalhes" />
          <div className="flex flex-wrap gap-2 px-5 pt-4">
            <Badge tone={statusTone[ticket.status]}>{statusLabel[ticket.status]}</Badge>
            <Badge tone={priorityTone[ticket.priority]}>{priorityLabel[ticket.priority]}</Badge>
            <Badge>{ticketTypeLabel[ticket.ticketType]}</Badge>
          </div>
          <div className="whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed text-slate-300">
            {ticket.description || <span className="text-slate-400">Sem descrição.</span>}
          </div>
          <div className="border-t border-slate-800">
            <DetailList
              items={[
                { label: "Solicitante", value: ticket.requester?.username },
                { label: "Regulador", value: ticket.regulator?.username ?? "Não encaminhado" },
                { label: "Encaminhado para", value: ticket.forwarded?.username ?? "Ninguém ainda" },
                { label: "Responsável", value: ticket.assignee?.username ?? "Ninguém assumiu" },
                { label: "Unidade", value: ticket.facility && `${ticket.facility.name} (${ticket.facility.code})` },
                { label: "Aberto em", value: formatDateTime(ticket.createdAt) },
                { label: "Atualizado em", value: formatDateTime(ticket.updatedAt) },
              ]}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Histórico" />
          <ol className="space-y-4 px-5 py-4">
            {history.data?.items.length === 0 && <p className="text-sm text-slate-500">Sem histórico ainda.</p>}
            {history.error && <ErrorState error={history.error} />}
            {history.data?.items.map((h) => (
              <li key={h.id} className="relative flex gap-3 pl-1">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500 ring-4 ring-brand-500/20" />
                <div>
                  <Badge tone={statusTone[h.status]}>{statusLabel[h.status]}</Badge>
                  <p className="mt-1 text-xs text-slate-500">
                    {ticketTypeLabel[h.type]} · {formatDateTime(h.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <TicketChat ticket={ticket} me={me} className="mt-6 lg:w-2/3" />

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
