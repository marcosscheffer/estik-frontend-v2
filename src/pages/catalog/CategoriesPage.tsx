import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Tag } from "lucide-react";
import { useFilters } from "@/hooks/useFilters";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useViewMode } from "@/hooks/useViewMode";
import { categoriesService } from "@/services/catalog";
import { Button, Card, CardGrid, ErrorState, Input, Modal, PageHeader, Pagination, SearchInput, Table, Textarea, Tile, TileIcon, ViewToggle } from "@/components/ui";

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome"),
  description: z.string().trim(),
});
type FormData = z.infer<typeof schema>;

function CategoryModal({ open, onClose, id }: { open: boolean; onClose: () => void; id?: string }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });
  // A listagem só traz id/nome; a descrição vem do GET /categories/{id}.
  const detail = useQuery({
    queryKey: ["categories", "detail", id],
    queryFn: () => categoriesService.get(id!),
    enabled: open && !!id,
  });

  useEffect(() => {
    if (!open) return;
    reset({ name: detail.data?.name ?? "", description: detail.data?.description ?? "" });
  }, [open, detail.data, reset]);

  const save = useApiMutation({
    mutationFn: (d: FormData) => (id ? categoriesService.update(id, d) : categoriesService.create(d)),
    invalidate: [["categories"], ["lookup", "categories"]],
    success: id ? "Categoria atualizada" : "Categoria criada",
    onSuccess: onClose,
  });

  return (
    <Modal open={open} onClose={onClose} title={id ? "Editar categoria" : "Nova categoria"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button form="cat-form" type="submit" loading={save.isPending}>Salvar</Button></>}>
      <form id="cat-form" onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-4">
        <Input label="Nome" {...register("name")} error={errors.name?.message} />
        <Textarea label="Descrição" rows={3} {...register("description")} />
      </form>
    </Modal>
  );
}

export function CategoriesPage() {
  const { filters, page, setFilter, setPage } = useFilters({ name: "" });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [view, setView] = useViewMode("categories");

  const query = { ...filters, page, size: 20 };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["categories", "list", query],
    queryFn: () => categoriesService.list(query),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Categorias" description="Agrupam os itens do estoque."
        actions={<><ViewToggle value={view} onChange={setView} /><Button icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>Nova categoria</Button></>} />
      <Card>
        <div className="border-b border-slate-800 p-4">
          <div className="sm:max-w-sm">
            <SearchInput value={filters.name} onChange={(v) => setFilter("name", v)} placeholder="Buscar por nome" />
          </div>
        </div>
        {error ? <div className="p-4"><ErrorState error={error} /></div> : view === "grid" ? (
          <CardGrid
            compact
            rows={data?.items}
            loading={isLoading || isFetching}
            rowKey={(c) => c.id}
            renderCard={(c) => (
              <Tile className="flex-row items-center">
                <TileIcon icon={Tag} />
                <h3 className="min-w-0 flex-1 truncate font-medium text-slate-100">{c.name}</h3>
                <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setEditing(c.id)} aria-label="Editar" />
              </Tile>
            )}
          />
        ) : (
          <Table
            rows={data?.items}
            loading={isLoading || isFetching}
            rowKey={(c) => c.id}
            columns={[
              { header: "Nome", cell: (c) => <span className="font-medium text-slate-100">{c.name}</span> },
              {
                header: "",
                className: "text-right",
                cell: (c) => <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setEditing(c.id)} aria-label="Editar" />,
              },
            ]}
          />
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} totalItems={data.totalItems} onChange={setPage} />}
      </Card>
      <CategoryModal open={!!editing} onClose={() => setEditing(null)} id={editing === "new" ? undefined : editing ?? undefined} />
    </>
  );
}
