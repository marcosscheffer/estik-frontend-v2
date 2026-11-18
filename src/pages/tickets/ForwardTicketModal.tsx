import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import clsx from "clsx";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ticketsService } from "@/services/tickets";
import { usersService } from "@/services/users";
import { priorityLabel, specializationName, toOptions } from "@/lib/labels";
import { prettyRole, useRoleIdsWith } from "@/hooks/useRoles";
import { Button, Modal, SearchInput, Select } from "@/components/ui";
import type { TicketPriority, TicketResponse, UUID } from "@/types/api";

interface Props {
  open: boolean;
  onClose: () => void;
  ticket: TicketResponse;
}

// igual ao PermissionEnum.grantedBy(TICKET_WORK) do backend: o useRoleIdsWith já conta as
// permissões incluídas (SUPERVISOR, MANAGE e SYSTEM_MANAGE trazem TICKET_WORK)
const RECEIVERS = ["TICKET_WORK"] as const;
// mesmo limite do ForwardRequest (@Size(max = 10))
const MAX = 10;

/**
 * Escolhe quem vai atender (1 a 10 pessoas) e ajusta a prioridade (POST /tickets/{id}/forward).
 * A lista enviada SUBSTITUI a anterior: quem estava atendendo sai do atendimento e do chat.
 */
export function ForwardTicketModal({ open, onClose, ticket }: Props) {
  const current = useMemo(() => (ticket.forwarded ?? []).map((f) => f.user).filter(Boolean), [ticket.forwarded]);
  const assignees = useMemo(() => (ticket.assigneeds ?? []).map((a) => a.user).filter(Boolean), [ticket.assigneeds]);
  const [selected, setSelected] = useState<Set<UUID>>(new Set());
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority);
  const [search, setSearch] = useState("");
  const areaId = ticket.specialization?.id;
  // por padrão mostra quem é da área do chamado e quem não tem área (ex.: SUPER, que atende tudo)
  const [onlyArea, setOnlyArea] = useState(true);

  // ao abrir, já vem marcado quem está encaminhado hoje (fica fácil só somar ou tirar alguém)
  useEffect(() => {
    if (!open) return;
    setSelected(new Set(current.filter((u) => u.id !== ticket.requester?.id).map((u) => u.id)));
    setPriority(ticket.priority);
    setSearch("");
    setOnlyArea(true);
  }, [open, ticket, current]);

  const filterArea = onlyArea && !!areaId;
  // uma busca só; o filtro de área é feito aqui porque o GET /users não sabe juntar "área X ou sem área"
  const users = useQuery({
    queryKey: ["users", "list", { size: 100 }],
    queryFn: () => usersService.list({ size: 100 }),
    enabled: open,
  });
  // GET /users não filtra por permissão: quando dá para ler os perfis (SYSTEM_MANAGE),
  // mostra só quem pode receber; sem isso o backend recusa a lista inteira se alguém não puder
  const workers = useRoleIdsWith(RECEIVERS, open);
  const term = search.trim().toLowerCase();

  const options = (users.data?.items ?? [])
    .filter((u) => !workers || (!!u.role && workers.has(u.role.id)))
    .filter((u) => !filterArea || !u.specialization || u.specialization.id === areaId || selected.has(u.id))
    .filter((u) => !term || u.username.toLowerCase().includes(term))
    .sort((a, b) => a.username.localeCompare(b.username))
    .map((u) => {
      // o backend recusa o solicitante (TicketOwnerShipException); inativo não consegue entrar
      const isRequester = u.id === ticket.requester?.id;
      const note = isRequester
        ? "solicitante"
        : !u.active
          ? "inativo"
          : assignees.some((a) => a.id === u.id)
            ? "atendendo"
            : current.some((c) => c.id === u.id)
              ? "encaminhado"
              : "";
      return {
        id: u.id,
        name: u.username,
        detail: `${u.role?.name ? prettyRole(u.role.name) : "sem perfil"} · ${u.specialization?.name ?? "todas as áreas"}`,
        note,
        disabled: isRequester || !u.active,
      };
    });

  const full = selected.size >= MAX;
  const toggle = (id: UUID) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX) next.add(id);
      return next;
    });

  // quem atende hoje e não está mais marcado perde o atendimento (e o acesso ao chat)
  const removedAssignees = assignees.filter((a) => !selected.has(a.id));
  const keptAssignees = assignees.filter((a) => selected.has(a.id));

  const forward = useApiMutation({
    mutationFn: () => ticketsService.forward(ticket.id, { usersId: [...selected], priority }),
    invalidate: [["tickets"], ["notifications"], ["chats"]],
    success: "Chamado encaminhado",
    onSuccess: onClose,
  });

  const area = specializationName(ticket.specialization);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={current.length ? "Reencaminhar chamado" : "Encaminhar chamado"}
      description={`Área: ${area}. Escolha até ${MAX} pessoas. Qualquer uma pode assumir, e várias podem atender juntas.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            icon={<Send className="size-4" />}
            disabled={selected.size === 0}
            loading={forward.isPending}
            onClick={() => forward.mutate()}
          >
            Encaminhar{selected.size ? ` (${selected.size})` : ""}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-slate-200">Encaminhar para</span>
            <span className={clsx("text-xs tabular-nums", full ? "text-amber-400" : "text-slate-500")}>
              {selected.size}/{MAX} selecionados
            </span>
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar pelo nome..." />
          <div className="max-h-72 overflow-y-auto rounded-lg ring-1 ring-inset ring-slate-700">
            {users.isLoading && <p className="px-3 py-3 text-sm text-slate-500">Carregando...</p>}
            {users.error && <p className="px-3 py-3 text-sm text-rose-400">Não foi possível carregar a lista.</p>}
            {!users.isLoading && !users.error && options.length === 0 && (
              <p className="px-3 py-3 text-sm text-slate-500">Ninguém encontrado.</p>
            )}
            <ul className="divide-y divide-slate-800">
              {options.map((o) => {
                const checked = selected.has(o.id);
                const blocked = o.disabled || (!checked && full);
                return (
                  <li key={o.id}>
                    <label
                      className={clsx(
                        "flex items-center gap-3 px-3 py-2",
                        blocked ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-slate-800/60",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 rounded border-slate-600 bg-slate-900 accent-blue-500"
                        checked={checked}
                        disabled={blocked}
                        onChange={() => toggle(o.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-100">{o.name}</span>
                        <span className="block truncate text-xs text-slate-500">{o.detail}</span>
                      </span>
                      {o.note && <span className="shrink-0 text-xs text-slate-400">{o.note}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
          {!workers && (
            <p className="text-xs text-slate-500">
              Sem acesso aos perfis não dá para saber quem atende chamados: se alguém da lista não puder, o encaminhamento inteiro é recusado.
            </p>
          )}
        </div>

        {assignees.length > 0 && (
          <div className="rounded-lg bg-amber-950/40 px-3 py-2.5 text-xs leading-relaxed text-amber-200 ring-1 ring-inset ring-amber-900">
            {removedAssignees.length > 0 && (
              <p>
                <strong>{removedAssignees.map((u) => u.username).join(", ")}</strong>{" "}
                {removedAssignees.length > 1 ? "saem" : "sai"} do atendimento e perde{removedAssignees.length > 1 ? "m" : ""} o acesso ao chat (as mensagens ficam).
              </p>
            )}
            {keptAssignees.length > 0 && (
              <p>
                <strong>{keptAssignees.map((u) => u.username).join(", ")}</strong> continua{keptAssignees.length > 1 ? "m" : ""} na lista, mas{" "}
                {keptAssignees.length > 1 ? "precisam" : "precisa"} assumir de novo.
              </p>
            )}
          </div>
        )}

        {areaId && (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="size-4 rounded border-slate-600 bg-slate-900 accent-blue-500"
              checked={onlyArea}
              onChange={(e) => setOnlyArea(e.target.checked)}
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
