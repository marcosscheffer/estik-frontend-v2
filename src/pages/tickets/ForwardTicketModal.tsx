import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ticketsService } from "@/services/tickets";
import { usersService } from "@/services/users";
import { priorityLabel, ticketTypeLabel, toOptions } from "@/lib/labels";
import { prettyRole, useRoleIdsWith, useRoles } from "@/hooks/useRoles";
import { Button, Modal, Select } from "@/components/ui";
import type { TicketPriority, TicketResponse } from "@/types/api";

interface Props {
  open: boolean;
  onClose: () => void;
  ticket: TicketResponse;
}

const RECEIVERS = ["TICKET_WORK"] as const;

/** Escolhe o técnico e ajusta a prioridade (POST /tickets/{id}/forward). */
export function ForwardTicketModal({ open, onClose, ticket }: Props) {
  const [userId, setUserId] = useState("");
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority);

  useEffect(() => {
    if (!open) return;
    setUserId("");
    setPriority(ticket.priority);
  }, [open, ticket]);

  // GET /users ainda não filtra por permissão: busca os ativos e, quando dá para
  // ler os perfis (ACCESS_MANAGE), mostra só quem tem TICKET_WORK.
  const users = useQuery({
    queryKey: ["users", "list", { size: 100 }],
    queryFn: () => usersService.list({ size: 100 }),
    enabled: open,
  });
  const { nameOf } = useRoles();
  const workers = useRoleIdsWith(RECEIVERS, open);
  const loading = users.isLoading;
  const loadError = !!users.error;
  const options = (users.data?.items ?? [])
    .filter((u) => !workers || workers.has(u.role))
    .sort((a, b) => a.username.localeCompare(b.username))
    .map((u) => {
      // o solicitante e quem está inativo aparecem, mas não dá para escolher
      const isRequester = u.id === ticket.requester?.id;
      const current = u.id === ticket.forwarded?.id;
      const note = isRequester ? " (solicitante)" : !u.active ? " (inativo)" : current ? " (atual)" : "";
      const role = nameOf(u.role);
      return {
        value: u.id,
        label: `${u.username}${role ? ` — ${prettyRole(role)}` : ""}${note}`,
        disabled: isRequester || !u.active,
      };
    });
  const available = options.filter((o) => !o.disabled).length;

  const forward = useApiMutation({
    mutationFn: () => ticketsService.forward(ticket.id, { userId, priority }),
    invalidate: [["tickets"], ["notifications"]],
    success: "Chamado encaminhado",
    onSuccess: onClose,
  });

  const area = ticketTypeLabel[ticket.ticketType];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Encaminhar chamado"
      description={`Chamado de ${area}: escolha quem vai atender. O chamado fica "Encaminhado" até a pessoa assumir.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button icon={<Send className="size-4" />} disabled={!userId} loading={forward.isPending} onClick={() => forward.mutate()}>
            Encaminhar
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Select
          label="Encaminhar para"
          options={options}
          placeholder={loading ? "Carregando..." : available ? "Selecione quem vai atender" : "Ninguém disponível"}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          error={loadError ? "Não foi possível carregar a lista." : undefined}
          hint={
            ticket.forwarded
              ? `Hoje está com ${ticket.forwarded.username}. Reencaminhar troca o responsável.`
              : !workers
                ? "Mostrando todos os usuários ativos: sem acesso aos perfis não dá para filtrar quem atende chamados."
                : undefined
          }
        />
        <Select
          label="Prioridade"
          options={toOptions(priorityLabel)}
          value={priority}
          onChange={(e) => setPriority(e.target.value as TicketPriority)}
        />
      </div>
    </Modal>
  );
}
