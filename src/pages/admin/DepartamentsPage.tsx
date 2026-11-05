import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Network, Pencil, Plus, Trash2 } from "lucide-react";
import { useFilters } from "@/hooks/useFilters";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useViewMode } from "@/hooks/useViewMode";
import { departamentsService } from "@/services/departaments";
import { Badge, Button, Card, CardGrid, ConfirmDialog, ErrorState, Input, Modal, PageHeader, Pagination, SearchInput, Table, Tile, TileIcon, ViewToggle } from "@/components/ui";
import { FacilitySelect } from "@/components/LookupSelects";
import type { DepartamentSummaryResponse } from "@/types/api";

const schema = z.object({
  facilityId: z.string().min(1, "Selecione a unidade"),
  name: z.string().trim().min(1, "Informe o nome"),
  code: z.string().trim().min(1, "Informe o código"),
});
type FormData = z.infer<typeof schema>;

export function DepartamentModal({ open, onClose, dep }: { open: boolean; onClose: () => void; dep?: DepartamentSummaryResponse }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (open) reset({ facilityId: dep?.facility.id ?? "", name: dep?.name ?? "", code: dep?.code ?? "" });
  }, [open, dep, reset]);

  const save = useApiMutation({
    mutationFn: ({ facilityId, ...d }: FormData) =>
      dep ? departamentsService.update(dep.id, d) : departamentsService.create({ facilityId, ...d }),
    invalidate: [["departaments"], ["lookup", "departaments"]],
    success: dep ? "Departamento atualizado" : "Departamento criado",
    onSuccess: onClose,
  });

  return (
    <Modal open={open} onClose={onClose} title={dep ? "Editar departamento" : "Novo departamento"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button form="dep-form" type="submit" loading={save.isPending}>Salvar</Button></>}>
      <form id="dep-form" onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-4">
        <FacilitySelect label="Unidade" disabled={!!dep} {...register("facilityId")} error={errors.facilityId?.message} />
        <Input label="Nome" {...register("name")} error={errors.name?.message} />
        <Input label="Código" {...register("code")} error={errors.code?.message} />
      </form>
    </Modal>
  );
}

export function DepartamentsPage() {
  const { filters, page, setFilter, setPage } = useFilters({ name: "", code: "", facilityId: "" });
  const [editing, setEditing] = useState<DepartamentSummaryResponse | "new" | null>(null);
  const [deleting, setDeleting] = useState<DepartamentSummaryResponse | null>(null);
  const [view, setView] = useViewMode("departaments");
  const navigate = useNavigate();
  const open = (d: DepartamentSummaryResponse) => navigate(`/departaments/${d.id}`);

  // stopPropagation: os botões não podem abrir o detalhe do card/linha
  const actions = (d: DepartamentSummaryResponse) => (
    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setEditing(d)} aria-label="Editar" />
      <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setDeleting(d)} aria-label="Excluir" />
    </div>
  );

  const query = { ...filters, page, size: 20 };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["departaments", "list", query],
    queryFn: () => departamentsService.list(query),
    placeholderData: keepPreviousData,
  });

  const remove = useApiMutation({
    mutationFn: (id: string) => departamentsService.remove(id),
    invalidate: [["departaments"], ["lookup", "departaments"]],
    success: "Departamento excluído",
    onSuccess: () => setDeleting(null),
  });

  return (
    <>
      <PageHeader title="Departamentos" description="Setores dentro de cada unidade."
        actions={<><ViewToggle value={view} onChange={setView} /><Button icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>Novo departamento</Button></>} />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 p-4">
          <div className="w-full min-w-56 flex-1">
            <SearchInput value={filters.name} onChange={(v) => setFilter("name", v)} placeholder="Buscar por nome" />
          </div>
          <div className="w-full sm:w-48">
            <SearchInput value={filters.code} onChange={(v) => setFilter("code", v)} placeholder="Código" />
          </div>
          <FacilitySelect className="w-full sm:w-52" placeholder="Todas as unidades" value={filters.facilityId} onChange={(e) => setFilter("facilityId", e.target.value)} />
        </div>
        {error ? <div className="p-4"><ErrorState error={error} /></div> : view === "grid" ? (
          <CardGrid
            compact
            rows={data?.items}
            loading={isLoading || isFetching}
            rowKey={(d) => d.id}
            renderCard={(d) => (
              <Tile onClick={() => open(d)}>
                <div className="flex items-start gap-3">
                  <TileIcon icon={Network} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium text-slate-100">{d.name}</h3>
                    <Badge tone="blue">{d.code}</Badge>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 items-center gap-1 text-xs text-slate-400">
                    <Building2 className="size-3.5 shrink-0" />
                    <span className="truncate">{d.facility?.name ?? "—"}</span>
                  </span>
                  {actions(d)}
                </div>
              </Tile>
            )}
          />
        ) : (
          <Table
            rows={data?.items}
            loading={isLoading || isFetching}
            rowKey={(d) => d.id}
            onRowClick={open}
            columns={[
              { header: "Nome", cell: (d) => <span className="font-medium text-slate-100">{d.name}</span> },
              { header: "Código", cell: (d) => d.code },
              { header: "Unidade", cell: (d) => d.facility?.name },
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

      <DepartamentModal open={!!editing} onClose={() => setEditing(null)} dep={editing === "new" ? undefined : editing ?? undefined} />
      <ConfirmDialog
        open={!!deleting}
        title="Excluir departamento?"
        message={<>O departamento <strong>{deleting?.name}</strong> será excluído.</>}
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
