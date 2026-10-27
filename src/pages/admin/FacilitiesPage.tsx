import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useFilters } from "@/hooks/useFilters";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useViewMode } from "@/hooks/useViewMode";
import { facilitiesService } from "@/services/facilities";
import { Badge, Button, Card, CardGrid, ConfirmDialog, ErrorState, Input, Modal, PageHeader, Pagination, SearchInput, Table, Tile, TileIcon, ViewToggle } from "@/components/ui";
import type { FacilitySummaryResponse } from "@/types/api";

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome"),
  code: z.string().trim().min(1, "Informe o código"),
});
type FormData = z.infer<typeof schema>;

export function FacilityModal({ open, onClose, facility }: { open: boolean; onClose: () => void; facility?: FacilitySummaryResponse }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (open) reset({ name: facility?.name ?? "", code: facility?.code ?? "" });
  }, [open, facility, reset]);

  const save = useApiMutation({
    mutationFn: (d: FormData) => (facility ? facilitiesService.update(facility.id, d) : facilitiesService.create(d)),
    invalidate: [["facilities"], ["lookup", "facilities"]],
    success: facility ? "Unidade atualizada" : "Unidade criada",
    onSuccess: onClose,
  });

  return (
    <Modal open={open} onClose={onClose} title={facility ? "Editar unidade" : "Nova unidade"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button form="facility-form" type="submit" loading={save.isPending}>Salvar</Button></>}>
      <form id="facility-form" onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-4">
        <Input label="Nome" {...register("name")} error={errors.name?.message} />
        <Input label="Código" placeholder="SP01" {...register("code")} error={errors.code?.message} />
      </form>
    </Modal>
  );
}

export function FacilitiesPage() {
  const { filters, page, setFilter, setPage } = useFilters({ q: "" });
  const [editing, setEditing] = useState<FacilitySummaryResponse | "new" | null>(null);
  const [deleting, setDeleting] = useState<FacilitySummaryResponse | null>(null);
  const [view, setView] = useViewMode("facilities");
  const navigate = useNavigate();
  const open = (f: FacilitySummaryResponse) => navigate(`/facilities/${f.id}`);

  // stopPropagation: copiar/editar/excluir não podem abrir o detalhe
  const copyId = (e: React.MouseEvent, f: FacilitySummaryResponse) => {
    e.stopPropagation();
    navigator.clipboard.writeText(f.id).then(() => toast.success("ID copiado"));
  };
  const actions = (f: FacilitySummaryResponse) => (
    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setEditing(f)} aria-label="Editar" />
      <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setDeleting(f)} aria-label="Excluir" />
    </div>
  );

  const query = { ...filters, page, size: 20 };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["facilities", "list", query],
    queryFn: () => facilitiesService.list(query),
    placeholderData: keepPreviousData,
  });

  const remove = useApiMutation({
    mutationFn: (id: string) => facilitiesService.remove(id),
    invalidate: [["facilities"], ["lookup", "facilities"]],
    success: "Unidade excluída",
    onSuccess: () => setDeleting(null),
  });

  return (
    <>
      <PageHeader title="Unidades" description="Filiais e locais atendidos."
        actions={<><ViewToggle value={view} onChange={setView} /><Button icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>Nova unidade</Button></>} />
      <Card>
        <div className="border-b border-slate-800 p-4 sm:max-w-sm">
          <SearchInput value={filters.q} onChange={(v) => setFilter("q", v)} placeholder="Buscar por nome" />
        </div>
        {error ? <div className="p-4"><ErrorState error={error} /></div> : view === "grid" ? (
          <CardGrid
            compact
            rows={data?.items}
            loading={isLoading || isFetching}
            rowKey={(f) => f.id}
            renderCard={(f) => (
              <Tile onClick={() => open(f)}>
                <div className="flex items-start gap-3">
                  <TileIcon icon={Building2} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium text-slate-100">{f.name}</h3>
                    <Badge tone="blue">{f.code}</Badge>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <button
                    title="Copiar ID (usado no cadastro de usuários)"
                    onClick={(e) => copyId(e, f)}
                    className="inline-flex items-center gap-1 font-mono text-xs text-slate-500 hover:text-slate-200"
                  >
                    {f.id.slice(0, 8)}… <Copy className="size-3" />
                  </button>
                  {actions(f)}
                </div>
              </Tile>
            )}
          />
        ) : (
          <Table
            rows={data?.items}
            loading={isLoading || isFetching}
            rowKey={(f) => f.id}
            onRowClick={open}
            columns={[
              { header: "Nome", cell: (f) => <span className="font-medium text-slate-100">{f.name}</span> },
              { header: "Código", cell: (f) => f.code },
              {
                header: "ID",
                cell: (f) => (
                  <button
                    title="Copiar ID (usado no cadastro de usuários)"
                    onClick={(e) => copyId(e, f)}
                    className="inline-flex items-center gap-1 font-mono text-xs text-slate-500 hover:text-slate-200"
                  >
                    {f.id.slice(0, 8)}… <Copy className="size-3" />
                  </button>
                ),
              },
              {
                header: "",
                className: "text-right",
                cell: actions,
              },
            ]}
          />
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} totalItems={data.totalItems} onChange={setPage} />}
      </Card>

      <FacilityModal open={!!editing} onClose={() => setEditing(null)} facility={editing === "new" ? undefined : editing ?? undefined} />
      <ConfirmDialog
        open={!!deleting}
        title="Excluir unidade?"
        message={<>A unidade <strong>{deleting?.name}</strong> será excluída.</>}
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
