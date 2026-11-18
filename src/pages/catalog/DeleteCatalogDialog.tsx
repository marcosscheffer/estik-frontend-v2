import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { categoriesService, itemsService } from "@/services/catalog";
import { stockService } from "@/services/stock";
import { formatNumber } from "@/lib/format";
import { Button, Input, Modal } from "@/components/ui";
import type { UUID } from "@/types/api";

interface Target {
  id: UUID;
  name: string;
}

interface Props {
  kind: "item" | "category";
  target: Target | null;
  onClose: () => void;
}

/**
 * No banco, items.category_id, stock_balance.item_id e stock_movement.item_id são ON DELETE CASCADE:
 * apagar uma categoria apaga os itens dela, e apagar um item apaga os saldos e o histórico de movimentações.
 * Por isso mostramos o que vai junto e o botão só libera depois de digitar o nome exato (sem colar).
 */
export function DeleteCatalogDialog({ kind, target, onClose }: Props) {
  const [typed, setTyped] = useState("");
  const open = !!target;
  const isCategory = kind === "category";

  useEffect(() => setTyped(""), [target?.id]);

  // categoria: quantos itens tem e quanto há em estoque somando tudo
  const categoryInfo = useQuery({
    queryKey: ["delete-impact", "category", target?.id],
    enabled: open && isCategory,
    queryFn: async () => {
      const [items, stock] = await Promise.all([
        itemsService.list({ categoryId: target!.id, size: 1 }),
        stockService.byCategory({ name: target!.name, size: 100 }),
      ]);
      return { items: items.totalItems, quantity: stock.items.find((c) => c.id === target!.id)?.quantity ?? 0 };
    },
  });

  // item: em quantos lugares está guardado e quanto tem
  const itemInfo = useQuery({
    queryKey: ["delete-impact", "item", target?.id],
    enabled: open && !isCategory,
    queryFn: async () => {
      const balances = await stockService.balances({ itemId: target!.id, size: 100 });
      return { places: balances.totalItems, quantity: balances.items.reduce((n, b) => n + (b.quantity ?? 0), 0) };
    },
  });

  const remove = useApiMutation({
    mutationFn: () => (isCategory ? categoriesService.remove(target!.id) : itemsService.remove(target!.id)),
    invalidate: [["items"], ["categories"], ["lookup", "items"], ["lookup", "categories"], ["stock"]],
    success: isCategory ? "Categoria apagada" : "Item apagado",
    onSuccess: onClose,
  });

  const matches = !!target && typed === target.name;
  const loading = remove.isPending;
  const show = (q: { isLoading: boolean; isError: boolean }, v: number | undefined) =>
    q.isError ? "?" : q.isLoading ? "…" : formatNumber(v ?? 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Apagar ${isCategory ? "a categoria" : "o item"} ${target?.name ?? ""}`}
      description="Esta ação não pode ser desfeita."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="danger" icon={<Trash2 className="size-4" />} loading={loading} disabled={!matches} onClick={() => remove.mutate()}>
            Apagar definitivamente
          </Button>
        </>
      }
    >
      {target && (
        <div className="space-y-4 text-sm text-slate-400">
          <div className="flex gap-3 rounded-lg border border-red-900/60 bg-red-950/40 p-3 text-red-200">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-400" />
            <div className="space-y-1.5">
              <p className="font-medium">O que é apagado junto:</p>
              <ul className="list-disc space-y-1 pl-4 text-red-200/90">
                {isCategory ? (
                  <>
                    <li><b>Todos os itens</b> desta categoria.</li>
                    <li>Os <b>saldos</b> desses itens em todas as unidades e departamentos.</li>
                    <li>O <b>histórico de movimentações</b> (entradas, saídas, transferências) desses itens.</li>
                  </>
                ) : (
                  <>
                    <li>Os <b>saldos</b> deste item em todas as unidades e departamentos.</li>
                    <li>O <b>histórico de movimentações</b> (entradas, saídas, transferências) deste item.</li>
                  </>
                )}
              </ul>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-2 text-center">
            {isCategory ? (
              <>
                <div className="rounded-lg bg-slate-800/60 p-2">
                  <dt className="text-xs text-slate-500">Itens</dt>
                  <dd className="text-lg font-semibold text-slate-100">{show(categoryInfo, categoryInfo.data?.items)}</dd>
                </div>
                <div className="rounded-lg bg-slate-800/60 p-2">
                  <dt className="text-xs text-slate-500">Em estoque</dt>
                  <dd className="text-lg font-semibold text-slate-100">{show(categoryInfo, categoryInfo.data?.quantity)}</dd>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg bg-slate-800/60 p-2">
                  <dt className="text-xs text-slate-500">Locais com saldo</dt>
                  <dd className="text-lg font-semibold text-slate-100">{show(itemInfo, itemInfo.data?.places)}</dd>
                </div>
                <div className="rounded-lg bg-slate-800/60 p-2">
                  <dt className="text-xs text-slate-500">Em estoque</dt>
                  <dd className="text-lg font-semibold text-slate-100">{show(itemInfo, itemInfo.data?.quantity)}</dd>
                </div>
              </>
            )}
          </dl>
          <p className="text-slate-300">
            Se a ideia é só corrigir o nome ou {isCategory ? "o mínimo" : "a categoria"}, feche esta janela e use o lápis (editar).
          </p>

          <div>
            <label htmlFor="confirm-catalog-name" className="mb-1.5 block text-slate-300">
              Para confirmar, digite o nome {isCategory ? "da categoria" : "do item"} exatamente como está:{" "}
              <code className="select-none rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-100">{target.name}</code>
            </label>
            <Input
              id="confirm-catalog-name"
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onPaste={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              onKeyDown={(e) => e.key === "Enter" && matches && !loading && remove.mutate()}
              placeholder={target.name}
              aria-invalid={typed !== "" && !matches}
            />
            <p className="mt-1.5 text-xs text-slate-500">
              {typed !== "" && !matches ? "O nome não confere (maiúsculas e espaços contam)." : "Colar está desativado neste campo. Depois de apagar, some para todos os usuários."}
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
