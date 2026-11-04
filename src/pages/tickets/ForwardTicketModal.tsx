import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ticketsService } from "@/services/tickets";
import { usersService } from "@/services/users";
import { priorityLabel, roleLabel, ticketTypeLabel, toOptions } from "@/lib/labels";
import { Button, Modal, Select } from "@/components/ui";
import type { TicketPriority, TicketResponse } from "@/types/api";

interface Props {
  open: boolean;
  onClose: () => void;
  ticket: TicketResponse;
}

/** Escolhe o técnico e ajusta a prioridade (POST /tickets/{id}/forward). */
export function ForwardTicketModal({ open, onClose, ticket }: Props) {
  const [userId, setUserId] = useState("");
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority);

  useEffect(() => {
    if (!open) return;
    setUserId("");
    setPriority(ticket.priority);
  }, [open, ticket]);

  // Técnicos e administradores. GET /users filtra um papel por vez, então são duas buscas.
  const targets = useQueries({
    queries: [
      { role: "TECHNICIAN" as const, size: 100 },
      { role: "ADMINISTRATOR" as const, size: 100 },
    ].map((params) => ({
      queryKey: ["users", "list", params],
      queryFn: () => usersService.list(params),
      enabled: open,
    })),
  });
  const loading = targets.some((q) => q.isLoading);
  const loadError = targets.some((q) => q.error);
  const seen = new Set<string>();
  const options = targets
    .flatMap((q) => q.data?.items ?? [])
    .filter((u) => !seen.has(u.id) && !!seen.add(u.id))
    // técnicos primeiro, depois administradores
    .sort((a, b) => Number(a.role === "ADMINISTRATOR") - Number(b.role === "ADMINISTRATOR") || a.username.localeCompare(b.username))
    .map((u) => {
      // o solicitante e quem está inativo aparecem, mas não dá para escolher
      const isRequester = u.id === ticket.requester?.id;
      const current = u.id === ticket.forwarded?.id;
      const note = isRequester ? " (solicitante)" : !u.active ? " (inativo)" : current ? " (atual)" : "";
      return {
        value: u.id,
        label: `${u.username} — ${roleLabel[u.role]}${note}`,
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
      description={`Chamado de ${area}: escolha um técnico ou um administrador. O chamado fica "Encaminhado" até a pessoa assumir.`}
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
          hint={ticket.forwarded ? `Hoje está com ${ticket.forwarded.username}. Reencaminhar troca o responsável.` : undefined}
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
