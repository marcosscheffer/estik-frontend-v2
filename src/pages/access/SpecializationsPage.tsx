import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers, Plus, Trash2 } from "lucide-react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { specializationsService } from "@/services/specializations";
import { formatDateTime } from "@/lib/format";
import { Button, Card, CardHeader, ConfirmDialog, EmptyState, ErrorState, Input, PageHeader, PageLoader } from "@/components/ui";
import type { SpecializationResponse } from "@/types/api";

/**
 * Áreas de atendimento (especializações), ex.: TI, Manutenção.
 * - listar: GET /specializations (qualquer logado)
 * - criar: POST /specializations { name } (SYSTEM_MANAGE)
 * - apagar: DELETE /specializations/{id} (SYSTEM_MANAGE)
 * Todo chamado tem uma área; o supervisor vê os chamados da área dele.
 */
export function SpecializationsPage() {
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<SpecializationResponse | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["specializations", "list"],
    queryFn: () => specializationsService.list({ size: 100 }),
  });
  const items = [...(data?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  // a lista dos <select> (useSpecializationOptions) também precisa ser recarregada
  const invalidate = [["specializations"], ["lookup", "specializations"]];
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

  return (
    <>
      <PageHeader
        title="Áreas"
        description="Áreas de atendimento (especializações). Cada chamado é aberto para uma área e o supervisor vê os chamados da área dele."
      />
      <Card className="max-w-2xl">
        <CardHeader title="Áreas cadastradas" />
        <form
          className="flex gap-2 border-b border-slate-800 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <Input className="flex-1" placeholder="Nova área (ex.: TI, Manutenção)" maxLength={50} value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome da nova área" />
          <Button type="submit" icon={<Plus className="size-4" />} disabled={!name.trim()} loading={create.isPending}>
            Criar
          </Button>
        </form>
        {error ? (
          <div className="p-4"><ErrorState error={error} /></div>
        ) : isLoading ? (
          <PageLoader />
        ) : items.length === 0 ? (
          <EmptyState icon={<Layers className="size-5" />} title="Nenhuma área ainda" message="Crie as áreas antes de abrir chamados: o formulário exige uma." />
        ) : (
          <ul className="divide-y divide-slate-800">
            {items.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                <Layers className="size-4 shrink-0 text-slate-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-100">{s.name}</p>
                  {s.createdAt && <p className="text-xs text-slate-500">Criada em {formatDateTime(s.createdAt)}</p>}
                </div>
                <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" />} onClick={() => setToDelete(s)} aria-label={`Apagar ${s.name}`} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        title={`Apagar a área ${toDelete?.name ?? ""}?`}
        message="Se ainda houver chamados ou usuários nesta área, o backend pode recusar."
        confirmLabel="Apagar"
        danger
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
