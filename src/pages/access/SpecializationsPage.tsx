import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Layers, Pencil, Plus, Trash2, X } from "lucide-react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useAuth } from "@/contexts/AuthContext";
import { access } from "@/lib/permissions";
import { specializationsService } from "@/services/specializations";
import { ticketsService } from "@/services/tickets";
import { usersService } from "@/services/users";
import { formatDateTime } from "@/lib/format";
import { Button, Card, CardHeader, EmptyState, ErrorState, Input, Modal, PageHeader, PageLoader } from "@/components/ui";
import type { SpecializationResponse, TicketStatus } from "@/types/api";

/** VARCHAR(50) NOT NULL UNIQUE na tabela specializations (V23). */
const NAME_MAX = 50;

/**
 * Áreas de atendimento (especializações), ex.: TI, Manutenção.
 * - listar: GET /specializations (qualquer logado)
 * - criar: POST /specializations { name } (SYSTEM_MANAGE)
 * - renomear: PUT /specializations/{id} { name } (SYSTEM_MANAGE)
 * - apagar: DELETE /specializations/{id} (SYSTEM_MANAGE)
 * Todo chamado tem uma área; o supervisor vê os chamados da área dele.
 */
export function SpecializationsPage() {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<SpecializationResponse | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["specializations", "list"],
    queryFn: () => specializationsService.list({ size: 100 }),
  });
  const items = [...(data?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  /** O nome é UNIQUE no banco: avisa antes de mandar e tomar 409. */
  const nameTaken = (value: string, exceptId?: string) =>
    items.some((s) => s.id !== exceptId && s.name.trim().toLowerCase() === value.trim().toLowerCase());

  // a lista dos <select> (useSpecializationOptions) também precisa ser recarregada;
  // chamados e usuários mostram o nome da área, então também ficam desatualizados
  const invalidate = [["specializations"], ["lookup", "specializations"], ["tickets"], ["users"]];
  const create = useApiMutation({
    mutationFn: () => specializationsService.create(name.trim()),
    invalidate,
    success: (s) => `Área ${s.name} criada`,
    onSuccess: () => setName(""),
  });
  const remove = useApiMutation({
    mutationFn: (id: string) => specializationsService.remove(id),
    invalidate,
    success: "Área apagada",
    onSuccess: () => setToDelete(null),
  });

  const createDuplicate = name.trim() !== "" && nameTaken(name);

  return (
    <>
      <PageHeader
        title="Áreas"
        description="Áreas de atendimento (especializações). Cada chamado é aberto para uma área e o supervisor vê os chamados da área dele."
      />
      <Card className="max-w-2xl">
        <CardHeader title="Áreas cadastradas" />
        <form
          className="border-b border-slate-800 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && !createDuplicate) create.mutate();
          }}
        >
          <div className="flex gap-2">
            <Input className="flex-1" placeholder="Nova área (ex.: TI, Manutenção)" maxLength={NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome da nova área" />
            <Button type="submit" icon={<Plus className="size-4" />} disabled={!name.trim() || createDuplicate} loading={create.isPending}>
              Criar
            </Button>
          </div>
          {createDuplicate && <p className="mt-1.5 text-xs text-red-400">Já existe uma área com esse nome.</p>}
        </form>
        {error ? (
          <div className="p-4"><ErrorState error={error} /></div>
        ) : isLoading ? (
          <PageLoader />
        ) : items.length === 0 ? (
          <EmptyState icon={<Layers className="size-5" />} title="Nenhuma área ainda" message="Crie as áreas antes de abrir chamados: o formulário exige uma." />
        ) : (
          <ul className="divide-y divide-slate-800">
            {items.map((s) =>
              editingId === s.id ? (
                <RenameRow
                  key={s.id}
                  area={s}
                  invalidate={invalidate}
                  nameTaken={(v) => nameTaken(v, s.id)}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <Layers className="size-4 shrink-0 text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-100">{s.name}</p>
                    {s.createdAt && <p className="text-xs text-slate-500">Criada em {formatDateTime(s.createdAt)}</p>}
                  </div>
                  <Button variant="ghost" size="sm" icon={<Pencil className="size-4" />} onClick={() => setEditingId(s.id)} aria-label={`Renomear ${s.name}`} title="Renomear" />
                  <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" />} onClick={() => setToDelete(s)} aria-label={`Apagar ${s.name}`} title="Apagar" />
                </li>
              ),
            )}
          </ul>
        )}
      </Card>

      <DeleteAreaDialog
        area={toDelete}
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onClose={() => !remove.isPending && setToDelete(null)}
      />
    </>
  );
}

/* ---------- Renomear (inline na linha) ---------- */

interface RenameRowProps {
  area: SpecializationResponse;
  invalidate: string[][];
  nameTaken: (value: string) => boolean;
  onDone: () => void;
}

function RenameRow({ area, invalidate, nameTaken, onDone }: RenameRowProps) {
  const [value, setValue] = useState(area.name);
  const trimmed = value.trim();
  const unchanged = trimmed === area.name;
  const duplicate = trimmed !== "" && !unchanged && nameTaken(trimmed);

  const rename = useApiMutation({
    mutationFn: () => specializationsService.rename(area.id, trimmed),
    invalidate,
    success: (s) => `Área renomeada para ${s.name}`,
    onSuccess: onDone,
  });

  const canSave = trimmed !== "" && !unchanged && !duplicate;

  return (
    <li className="px-5 py-3">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) rename.mutate();
        }}
      >
        <Layers className="size-4 shrink-0 text-slate-500" />
        <Input
          className="flex-1"
          autoFocus
          maxLength={NAME_MAX}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onDone()}
          aria-label={`Novo nome para ${area.name}`}
        />
        <Button type="submit" size="sm" icon={<Check className="size-4" />} disabled={!canSave} loading={rename.isPending}>
          Salvar
        </Button>
        <Button type="button" variant="ghost" size="sm" icon={<X className="size-4" />} onClick={onDone} disabled={rename.isPending} aria-label="Cancelar" title="Cancelar (Esc)" />
      </form>
      {duplicate ? (
        <p className="mt-1.5 pl-6 text-xs text-red-400">Já existe uma área com esse nome.</p>
      ) : (
        <p className="mt-1.5 pl-6 text-xs text-slate-500">
          Chamados e usuários desta área continuam nela; só o nome muda. Enter salva, Esc cancela.
        </p>
      )}
    </li>
  );
}

/* ---------- Apagar (confirmação rígida) ---------- */

const ACTIVE_STATUSES: TicketStatus[] = ["OPEN", "FORWARDED", "REFORWARDED", "PROGRESS"];

interface DeleteAreaDialogProps {
  area: SpecializationResponse | null;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * No banco, tickets.specialization_id, users.specialization_id e ticket_histories.specialization_id
 * são ON DELETE SET NULL: apagar a área não apaga nada, mas deixa tudo isso SEM área.
 * Por isso o botão só libera depois de digitar o nome exato (sem colar).
 */
function DeleteAreaDialog({ area, loading, onConfirm, onClose }: DeleteAreaDialogProps) {
  const { can } = useAuth();
  const [typed, setTyped] = useState("");
  const open = !!area;

  useEffect(() => setTyped(""), [area?.id]);

  // GET /tickets só devolve tudo para TICKET_MANAGE; para os outros a contagem sairia errada
  const canCountTickets = can("TICKET_MANAGE");
  const canCountUsers = can(access.listUsers);

  const tickets = useQuery({
    queryKey: ["tickets", "count-by-area", area?.id],
    enabled: open && canCountTickets,
    queryFn: async () => {
      const id = area!.id;
      const [all, ...active] = await Promise.all([
        ticketsService.list({ specializationId: id, size: 1 }),
        ...ACTIVE_STATUSES.map((status) => ticketsService.list({ specializationId: id, status, size: 1 })),
      ]);
      return { total: all.totalItems, active: active.reduce((n, p) => n + p.totalItems, 0) };
    },
  });
  const users = useQuery({
    queryKey: ["users", "count-by-area", area?.id],
    enabled: open && canCountUsers,
    queryFn: () => usersService.list({ specializationId: area!.id, size: 1 }).then((p) => p.totalItems),
  });

  const matches = !!area && typed === area.name;

  const count = (q: { isLoading: boolean; isError: boolean }, allowed: boolean, value: number | undefined) =>
    !allowed || q.isError ? "?" : q.isLoading ? "…" : String(value ?? 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Apagar a área ${area?.name ?? ""}`}
      description="Esta ação não pode ser desfeita."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="danger" icon={<Trash2 className="size-4" />} loading={loading} disabled={!matches} onClick={onConfirm}>
            Apagar definitivamente
          </Button>
        </>
      }
    >
      {area && (
        <div className="space-y-4 text-sm text-slate-400">
          <div className="flex gap-3 rounded-lg border border-red-900/60 bg-red-950/40 p-3 text-red-200">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-400" />
            <div className="space-y-1.5">
              <p className="font-medium">O que acontece ao apagar:</p>
              <ul className="list-disc space-y-1 pl-4 text-red-200/90">
                <li>Os chamados desta área ficam <b>sem área</b>. O supervisor da área deixa de vê-los e eles não aparecem mais no filtro por área.</li>
                <li>Os usuários desta área ficam <b>sem área</b>. Um supervisor sem área não vê mais os chamados da equipe.</li>
                <li>O histórico dos chamados perde a referência a esta área.</li>
                <li>Para continuar atendendo, será preciso mover chamados e usuários para outra área um por um.</li>
              </ul>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-slate-800/60 p-2">
              <dt className="text-xs text-slate-500">Chamados ativos</dt>
              <dd className="text-lg font-semibold text-slate-100">{count(tickets, canCountTickets, tickets.data?.active)}</dd>
            </div>
            <div className="rounded-lg bg-slate-800/60 p-2">
              <dt className="text-xs text-slate-500">Chamados no total</dt>
              <dd className="text-lg font-semibold text-slate-100">{count(tickets, canCountTickets, tickets.data?.total)}</dd>
            </div>
            <div className="rounded-lg bg-slate-800/60 p-2">
              <dt className="text-xs text-slate-500">Usuários</dt>
              <dd className="text-lg font-semibold text-slate-100">{count(users, canCountUsers, users.data)}</dd>
            </div>
          </dl>
          {(!canCountTickets || !canCountUsers || tickets.isError || users.isError) && (
            <p className="text-xs text-slate-500">"?" = seu perfil não permite contar esses registros; eles podem existir mesmo assim.</p>
          )}
          <p className="text-slate-300">
            Se a ideia é só trocar o nome, feche esta janela e use o lápis (renomear). Assim nada perde a área.
          </p>

          <div>
            <label htmlFor="confirm-area-name" className="mb-1.5 block text-slate-300">
              Para confirmar, digite o nome da área exatamente como está:{" "}
              <code className="select-none rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-100">{area.name}</code>
            </label>
            <Input
              id="confirm-area-name"
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onPaste={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              onKeyDown={(e) => e.key === "Enter" && matches && !loading && onConfirm()}
              placeholder={area.name}
              aria-invalid={typed !== "" && !matches}
            />
            <p className="mt-1.5 text-xs text-slate-500">
              {typed !== "" && !matches ? "O nome não confere (maiúsculas e espaços contam)." : "Colar está desativado neste campo."}
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
