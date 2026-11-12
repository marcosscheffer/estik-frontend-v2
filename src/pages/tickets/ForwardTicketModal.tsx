import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ticketsService } from "@/services/tickets";
import { usersService } from "@/services/users";
import { priorityLabel, specializationName, toOptions } from "@/lib/labels";
import { prettyRole, useRoleIdsWith } from "@/hooks/useRoles";
import { Button, Modal, Select } from "@/components/ui";
import type { TicketPriority, TicketResponse } from "@/types/api";

interface Props {
  open: boolean;
  onClose: () => void;
  ticket: TicketResponse;
}

// igual ao PermissionEnum.grantedBy(TICKET_WORK) do backend: o useRoleIdsWith já conta as
// permissões incluídas (SUPERVISOR, MANAGE e SYSTEM_MANAGE trazem TICKET_WORK)
const RECEIVERS = ["TICKET_WORK"] as const;

/** Escolhe o técnico e ajusta a prioridade (POST /tickets/{id}/forward). */
export function ForwardTicketModal({ open, onClose, ticket }: Props) {
  const [userId, setUserId] = useState("");
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority);
  const areaId = ticket.specialization?.id;
  // por padrão mostra quem é da área do chamado e quem não tem área (ex.: SUPER, que atende tudo)
  const [onlyArea, setOnlyArea] = useState(true);

  useEffect(() => {
    if (!open) return;
    setUserId("");
    setPriority(ticket.priority);
    setOnlyArea(true);
  }, [open, ticket]);

  const filterArea = onlyArea && !!areaId;
  // uma busca só; o filtro de área é feito aqui porque o GET /users não sabe juntar "área X ou sem área"
  const users = useQuery({
    queryKey: ["users", "list", { size: 100 }],
    queryFn: () => usersService.list({ size: 100 }),
    enabled: open,
  });
  // GET /users não filtra por permissão: quando dá para ler os perfis (SYSTEM_MANAGE),
  // mostra só quem pode receber; sem isso o backend recusa um perfil inválido ao encaminhar.
  const workers = useRoleIdsWith(RECEIVERS, open);
  const loading = users.isLoading;
  const loadError = !!users.error;
  const options = (users.data?.items ?? [])
    .filter((u) => !workers || (!!u.role && workers.has(u.role.id)))
    .filter((u) => !filterArea || !u.specialization || u.specialization.id === areaId)
    .sort((a, b) => a.username.localeCompare(b.username))
    .map((u) => {
      // o solicitante e quem está inativo aparecem, mas não dá para escolher
      const isRequester = u.id === ticket.requester?.id;
      const current = u.id === ticket.forwarded?.id;
      const note = isRequester ? " (solicitante)" : !u.active ? " (inativo)" : current ? " (atual)" : "";
      const role = u.role?.name;
      const userArea = u.specialization?.name ?? "todas as áreas";
      return {
        value: u.id,
        label: `${u.username}${role ? ` — ${prettyRole(role)}` : ""} · ${userArea}${note}`,
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

  const area = specializationName(ticket.specialization);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Encaminhar chamado"
      description={`Área: ${area}. Escolha quem vai atender. O chamado fica "Encaminhado" até a pessoa assumir.`}
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
                ? "Sem acesso aos perfis não dá para saber quem atende chamados: se o perfil não puder, o encaminhamento é recusado."
                : undefined
          }
        />
        {areaId && (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="size-4 rounded border-slate-600 bg-slate-900 accent-blue-500"
              checked={onlyArea}
              onChange={(e) => {
                setOnlyArea(e.target.checked);
                setUserId("");
              }}
            />
            Mostrar só quem é da área {area} (e quem atende todas)
          </label>
        )}
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
