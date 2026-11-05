import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Package, Pencil, Plus } from "lucide-react";
import { useFilters } from "@/hooks/useFilters";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useViewMode } from "@/hooks/useViewMode";
import { itemsService } from "@/services/catalog";
import { Button, Card, CardGrid, ErrorState, Input, Modal, PageHeader, Pagination, SearchInput, Table, Textarea, Tile, TileIcon, ViewToggle } from "@/components/ui";
import { CategorySelect } from "@/components/LookupSelects";

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome"),
  sku: z.string().trim().min(1, "Informe o SKU"),
  description: z.string().trim().min(1, "Informe a descrição"),
  minimum: z.coerce.number<number>().int("Use um número inteiro").min(0, "Não pode ser negativo"),
  categoryId: z.string().min(1, "Selecione a categoria"),
});
type FormData = z.infer<typeof schema>;

function ItemModal({ open, onClose, id }: { open: boolean; onClose: () => void; id?: string }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const detail = useQuery({
    queryKey: ["items", "detail", id],
    queryFn: () => itemsService.get(id!),
    enabled: open && !!id,
  });

  useEffect(() => {
    if (!open) return;
    const d = detail.data;
    reset({
      name: d?.name ?? "",
      sku: d?.sku ?? "",
      description: d?.description ?? "",
      minimum: d?.minimum ?? 0,
      categoryId: d?.categoryId ?? "",
    });
  }, [open, detail.data, reset]);

  const save = useApiMutation({
    mutationFn: (d: FormData) => (id ? itemsService.update(id, d) : itemsService.create(d)),
    invalidate: [["items"], ["lookup", "items"]],
    success: id ? "Item atualizado" : "Item criado",
    onSuccess: onClose,
  });

  return (
    <Modal open={open} onClose={onClose} title={id ? "Editar item" : "Novo item"} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button form="item-form" type="submit" loading={save.isPending}>Salvar</Button></>}>
      <form id="item-form" onSubmit={handleSubmit((d) => save.mutate(d))} className="grid gap-4 sm:grid-cols-2">
        <Input label="Nome" {...register("name")} error={errors.name?.message} />
        <Input label="SKU" placeholder="MOUSE-USB-01" {...register("sku")} error={errors.sku?.message} />
        <Textarea label="Descrição" rows={3} className="sm:col-span-2" {...register("description")} error={errors.description?.message} />
        <CategorySelect label="Categoria" {...register("categoryId")} error={errors.categoryId?.message} />
        <Input label="Estoque mínimo" type="number" min={0} {...register("minimum")} error={errors.minimum?.message} />
      </form>
    </Modal>
  );
}

export function ItemsPage() {
  const { filters, page, setFilter, setPage } = useFilters({ name: "", categoryId: "" });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [view, setView] = useViewMode("items");

  const query = { ...filters, page, size: 20 };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["items", "list", query],
    queryFn: () => itemsService.list(query),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Itens" description="Catálogo de materiais controlados no estoque."
        actions={<><ViewToggle value={view} onChange={setView} /><Button icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>Novo item</Button></>} />
      <Card>
        {/* sem filtro por SKU: o parâmetro `code` quebra no backend */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 p-4">
          <div className="w-full min-w-56 flex-1">
            <SearchInput value={filters.name} onChange={(v) => setFilter("name", v)} placeholder="Buscar por nome" />
          </div>
          <CategorySelect className="w-full sm:w-56" placeholder="Todas as categorias" value={filters.categoryId} onChange={(e) => setFilter("categoryId", e.target.value)} />
        </div>
        {error ? <div className="p-4"><ErrorState error={error} /></div> : view === "grid" ? (
          <CardGrid
            compact
            rows={data?.items}
            loading={isLoading || isFetching}
            rowKey={(i) => i.id}
            renderCard={(i) => (
              <Tile className="flex-row items-center">
                <TileIcon icon={Package} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-medium text-slate-100">{i.name}</h3>
                  <p className="truncate font-mono text-xs text-slate-500">{i.sku}</p>
                </div>
                <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setEditing(i.id)} aria-label="Editar" />
              </Tile>
            )}
          />
        ) : (
          <Table
            rows={data?.items}
            loading={isLoading || isFetching}
            rowKey={(i) => i.id}
            columns={[
              { header: "Nome", cell: (i) => <span className="font-medium text-slate-100">{i.name}</span> },
              { header: "SKU", cell: (i) => <span className="font-mono text-xs">{i.sku}</span> },
              {
                header: "",
                className: "text-right",
                cell: (i) => <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setEditing(i.id)} aria-label="Editar" />,
              },
            ]}
          />
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} totalItems={data.totalItems} onChange={setPage} />}
      </Card>
      <ItemModal open={!!editing} onClose={() => setEditing(null)} id={editing === "new" ? undefined : editing ?? undefined} />
    </>
  );
}
