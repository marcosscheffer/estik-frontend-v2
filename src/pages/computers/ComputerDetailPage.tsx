import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useApiMutation } from "@/hooks/useApiMutation";
import { access } from "@/lib/roles";
import { computersService, historiesService } from "@/services/computers";
import { formatDateTime } from "@/lib/format";
import { osLabel, storageTypeLabel } from "@/lib/labels";
import { Button, Card, CardHeader, ConfirmDialog, DetailList, ErrorState, PageHeader, PageLoader } from "@/components/ui";
import { EditComputerModal, MoveComputerModal } from "./ComputerModals";
import { HistoryTimeline } from "./HistoryTimeline";

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
        description={`${pc.facility?.name} · ${pc.departament?.name}`}
        actions={
          <>
            <Button icon={<ArrowRightLeft className="size-4" />} onClick={() => setModal("move")}>Mover</Button>
            <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setModal("edit")}>Editar</Button>
            <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setModal("delete")} aria-label="Excluir" />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Configuração" />
          <DetailList
            items={[
              { label: "Processador", value: pc.cpu },
              { label: "Memória", value: pc.ram },
              { label: "Sistema", value: osLabel[pc.os] },
              { label: "Armazenamento", value: `${pc.storage} (${storageTypeLabel[pc.storageType]})` },
              { label: "Unidade", value: `${pc.facility?.name} (${pc.facility?.code})` },
              {
                label: "Departamento",
                value: can(access.departaments) ? (
                  <Link to={`/departaments/${pc.departament.id}`} className="text-brand-400 hover:text-brand-300 hover:underline">
                    {pc.departament.name} ({pc.departament.code})
                  </Link>
                ) : (
                  `${pc.departament?.name} (${pc.departament?.code})`
                ),
              },
              { label: "Cadastrado em", value: formatDateTime(pc.createdAt) },
              { label: "Atualizado em", value: formatDateTime(pc.updatedAt) },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Histórico de serviços" />
          <HistoryTimeline rows={history.data?.items} loading={history.isLoading} hideComputer empty="Sem registros." />
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
