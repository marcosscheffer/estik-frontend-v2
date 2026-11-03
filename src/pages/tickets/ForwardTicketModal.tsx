import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ticketsService } from "@/services/tickets";
import { usersService } from "@/services/users";
import { functionLabel, priorityLabel, roleLabel, ticketTypeLabel, toOptions } from "@/lib/labels";
import { Button, Modal, Select } from "@/components/ui";
import type { TicketPriority, TicketResponse } from "@/types/api";

interface Props {
  open: boolean;
  onClose: () => void;
  ticket: TicketResponse;
}

/** Escolhe o técnico da área do chamado e ajusta a prioridade (POST /tickets/{id}/forward). */
export function ForwardTicketModal({ open, onClose, ticket }: Props) {
  const [userId, setUserId] = useState("");
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority);

  useEffect(() => {
    if (!open) return;
    setUserId("");
    setPriority(ticket.priority);
  }, [open, ticket]);

  // Técnicos e administradores de qualquer área (GET /users filtra um papel por vez).
  // Obs.: hoje o ForwardTicketUseCase só aceita role TECHNICIAN; administrador volta erro.
  const targets = useQueries({
    queries: (["TECHNICIAN", "ADMINISTRATOR"] as const).map((role) => {
      const params = { role, size: 100 };
      return {
        queryKey: ["users", "list", params],
        queryFn: () => usersService.list(params),
        enabled: open,
      };
    }),
  });
  const loading = targets.some((q) => q.isLoading);
  const loadError = targets.some((q) => q.error);
  const options = targets
    .flatMap((q) => q.data?.content ?? [])
    // primeiro quem é da área do chamado
    .sort((a, b) => Number(b.function === ticket.ticketType) - Number(a.function === ticket.ticketType) || a.username.localeCompare(b.username))
    .map((u) => {
      // quem já recebeu ou está inativo aparece, mas não dá para escolher
      const already = u.id === ticket.forwarded?.id;
      const note = already ? " (já recebeu)" : !u.active ? " (inativo)" : "";
      return {
        value: u.id,
        label: `${u.username} — ${roleLabel[u.role]}${u.function ? ` · ${functionLabel[u.function]}` : ""}${note}`,
        disabled: already || !u.active,
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
      description={`Escolha um técnico ou administrador (os de ${area} aparecem primeiro). O chamado volta para "Aberto" até a pessoa assumir.`}
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
          hint={ticket.forwarded ? `${ticket.forwarded.username} já recebeu este chamado e não pode ser escolhido de novo.` : undefined}
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
