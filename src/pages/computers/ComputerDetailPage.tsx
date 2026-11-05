import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useApiMutation } from "@/hooks/useApiMutation";
import { access } from "@/lib/roles";
import { computersService, historiesService } from "@/services/computers";
import { formatDateTime, formatRelative } from "@/lib/format";
import { osLabel, storageTypeLabel } from "@/lib/labels";
import { Badge, Button, Card, CardHeader, ConfirmDialog, ErrorState, PageHeader, PageLoader } from "@/components/ui";
import { EditComputerModal, MoveComputerModal } from "./ComputerModals";
import { HistoryTimeline } from "./HistoryTimeline";

function Field({ label, title, children }: { label: string; title?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-slate-100" title={title}>
        {children}
      </dd>
    </div>
  );
}

export function ComputerDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [modal, setModal] = useState<null | "edit" | "move" | "delete">(null);

  const { data: pc, isLoading, error } = useQuery({
    queryKey: ["computers", "detail", id],
    queryFn: () => computersService.get(id),
  });
  const history = useQuery({
    queryKey: ["histories", "list", { computerId: id }],
    queryFn: () => historiesService.list({ computerId: id, size: 50 }),
  });

  const remove = useApiMutation({
    mutationFn: () => computersService.remove(id),
    invalidate: [["computers"]],
    success: "Computador excluído",
    onSuccess: () => navigate("/computers"),
  });

  if (isLoading) return <PageLoader />;
  if (error || !pc) return <ErrorState error={error} />;

  return (
    <>
      <PageHeader
        back="/computers"
        title={pc.name}
        description={[pc.facility?.name, pc.departament?.name].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setModal("edit")}>Editar</Button>
            <Button variant="secondary" icon={<ArrowRightLeft className="size-4" />} onClick={() => setModal("move")}>Mover</Button>
            <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setModal("delete")} aria-label="Excluir" />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {/* mesmo padrão do detalhe do chamado: seções com rótulo pequeno e pares rótulo/valor */}
          <section className="px-5 py-4">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Hardware</h3>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label="Processador">{pc.cpu || "—"}</Field>
              <Field label="Memória">{pc.ram || "—"}</Field>
              <Field label="Sistema">
                <Badge>{osLabel[pc.os]}</Badge>
              </Field>
              <Field label="Armazenamento">
                <span className="inline-flex items-center gap-2">
                  {pc.storage || "—"} <Badge>{storageTypeLabel[pc.storageType]}</Badge>
                </span>
              </Field>
            </dl>
          </section>
          <section className="border-t border-slate-800 px-5 py-4">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Localização</h3>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label="Unidade">{pc.facility ? `${pc.facility.name} (${pc.facility.code})` : "—"}</Field>
              <Field label="Departamento">
                {!pc.departament ? (
                  "—"
                ) : can(access.departaments) ? (
                  <Link to={`/departaments/${pc.departament.id}`} className="text-brand-400 hover:text-brand-300 hover:underline">
                    {pc.departament.name} ({pc.departament.code})
                  </Link>
                ) : (
                  `${pc.departament.name} (${pc.departament.code})`
                )}
              </Field>
            </dl>
          </section>
          <dl className="grid gap-x-6 gap-y-3 border-t border-slate-800 px-5 py-4 sm:grid-cols-2">
            <Field label="Cadastrado em">{formatDateTime(pc.createdAt)}</Field>
            <Field label="Atualizado" title={formatDateTime(pc.updatedAt)}>
              {formatRelative(pc.updatedAt)}
            </Field>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Histórico de serviços" />
          <HistoryTimeline rows={history.data?.items} loading={history.isLoading} hideComputer empty="Nenhum serviço registrado neste computador." />
        </Card>
      </div>

      <EditComputerModal open={modal === "edit"} onClose={() => setModal(null)} computer={pc} />
      <MoveComputerModal open={modal === "move"} onClose={() => setModal(null)} computer={pc} />
      <ConfirmDialog
        open={modal === "delete"}
        title="Excluir computador?"
        message={<>O computador <strong>{pc.name}</strong> será removido do inventário.</>}
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setModal(null)}
      />
    </>
  );
}
