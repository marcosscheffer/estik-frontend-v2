import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ticketsService } from "@/services/tickets";
import { priorityLabel, ticketTypeLabel, toOptions } from "@/lib/labels";
import { Button, Input, Modal, Select, Textarea } from "@/components/ui";
import type { TicketResponse } from "@/types/api";

const schema = z.object({
  title: z.string().trim().min(1, "Informe um título"),
  description: z.string().trim(),
  ticketType: z.enum(["IT", "MAINTENANCE"]),
  // opcional porque o select fica desabilitado na edição (e campo desabilitado não envia valor)
  priority: z.enum(["MILD", "MODERATE", "URGENT"]).optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  ticket?: TicketResponse;
  onSaved?: (t: TicketResponse) => void;
}

export function TicketFormModal({ open, onClose, ticket, onSaved }: Props) {
  const { me } = useAuth();
  const editing = !!ticket;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset({
      title: ticket?.title ?? "",
      description: ticket?.description ?? "",
      ticketType: ticket?.ticketType ?? "IT",
      priority: ticket?.priority ?? "MODERATE",
    });
  }, [open, ticket, reset]);

  // A unidade do chamado é sempre a do usuário logado (não é mais escolhida no formulário).
  const facilityId = me?.facilityId ?? undefined;
  const missingFacility = !editing && !!me && !facilityId;

  const save = useApiMutation({
    mutationFn: (data: FormData) =>
      editing
        ? ticketsService.update(ticket.id, {
            title: data.title,
            description: data.description || data.title,
            // o update não aceita priority: depois de aberto, só quem encaminha muda
            ticketType: data.ticketType,
          })
        : ticketsService.create({
            ...data,
            facilityId: facilityId!,
            description: data.description || undefined,
            priority: data.priority ?? "MODERATE",
          }),
    invalidate: [["tickets"]],
    success: editing ? "Chamado atualizado" : "Chamado aberto",
    onSuccess: (t) => {
      onSaved?.(t);
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar chamado" : "Abrir chamado"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            form="ticket-form"
            type="submit"
            loading={save.isPending}
            disabled={!editing && !facilityId}
          >
            {editing ? "Salvar" : "Abrir chamado"}
          </Button>
        </>
      }
    >
      <form id="ticket-form" onSubmit={handleSubmit((d) => save.mutate(d))} className="grid gap-4 sm:grid-cols-2">
        <Input label="Título" className="sm:col-span-2" {...register("title")} error={errors.title?.message} />
        <Textarea
          label="Descrição"
          className="sm:col-span-2"
          rows={5}
          placeholder="Descreva o problema, onde acontece e desde quando."
          {...register("description")}
          error={errors.description?.message}
        />
        <Select label="Área" options={toOptions(ticketTypeLabel)} {...register("ticketType")} />
        <Select
          label="Prioridade"
          options={toOptions(priorityLabel)}
          disabled={editing}
          hint={editing ? "A prioridade é ajustada por quem encaminha o chamado." : undefined}
          {...register("priority")}
        />
        {missingFacility && (
          <p className="sm:col-span-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            Sua conta ainda não tem unidade definida. Peça ao administrador para vincular você a uma unidade antes de
            abrir chamados.
          </p>
        )}
      </form>
    </Modal>
  );
}
