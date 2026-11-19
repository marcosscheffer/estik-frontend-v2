import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { ArrowRightLeft, FilterX, PackageOpen, PackagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { access } from "@/lib/permissions";
import { useAuth } from "@/contexts/AuthContext";
import { useFilters } from "@/hooks/useFilters";
import { useViewMode } from "@/hooks/useViewMode";
import { stockService } from "@/services/stock";
import { categoriesService, itemsService } from "@/services/catalog";
import { formatNumber } from "@/lib/format";
import { Button, Card, CardGrid, EmptyState, ErrorState, Modal, PageHeader, Table, Tile, ViewToggle } from "@/components/ui";
import { DepartamentSelect, FacilitySelect } from "@/components/LookupSelects";
import type { ItemSummaryResponse, StockBalanceSummaryResponse } from "@/types/api";
import { MovementModal } from "./MovementModal";
import { MinimumTag } from "./BalanceCard";
import { categoryState } from "./BalanceCategoriesPage";
import { CategoryModal } from "@/pages/catalog/CategoriesPage";
import { ItemModal } from "@/pages/catalog/ItemsPage";
import { DeleteCatalogDialog } from "@/pages/catalog/DeleteCatalogDialog";

/** Um item da categoria com a soma dos seus saldos (respeitando os filtros). */
interface ItemTotal {
  item: ItemSummaryResponse;
  quantity: number;
  balances: StockBalanceSummaryResponse[];
  loading: boolean;
}

/**
 * Itens de uma categoria com o total de cada um.
 * O backend ainda não filtra /stock/balances por categoria, então:
 * 1) busca os itens da categoria (/items?categoryId=)
 * 2) busca os saldos de cada item (/stock/balances?itemId=) e soma aqui.
 */
export function CategoryBalancesPage() {
  const { categoryId = "" } = useParams();
  // mínimo e total chegam pela navegação (o GET /categories/{id} ainda não traz o mínimo)
  const nav = (useLocation().state ?? {}) as { minimum?: number | null; quantity?: number };
  const { can } = useAuth();
  const canWrite = can(access.stockWrite);
  const canCatalog = can(access.catalogWrite);
  const navigate = useNavigate();
  // criar/editar item (com a categoria travada), editar/apagar a categoria
  const [itemForm, setItemForm] = useState<{ id?: string } | null>(null);
  const [editingCategory, setEditingCategory] = useState(false);
  const [deleting, setDeleting] = useState<{ kind: "item" | "category"; id: string; name: string } | null>(null);
  const { filters, setFilter } = useFilters({ facilityId: "", departamentId: "" });
  const [, setParams] = useSearchParams();
  const [view, setView] = useViewMode("category-balances");
  const [selected, setSelected] = useState<ItemTotal | null>(null);
  const [movement, setMovement] = useState<{ open: boolean; from?: StockBalanceSummaryResponse }>({ open: false });
  const hasFilters = !!(filters.facilityId || filters.departamentId);

  const category = useQuery({
    queryKey: ["categories", categoryId],
    queryFn: () => categoriesService.get(categoryId),
    enabled: !!categoryId,
  });

  const items = useQuery({
    queryKey: ["items", { categoryId, size: 100 }],
    queryFn: () => itemsService.list({ categoryId, size: 100 }),
    enabled: !!categoryId,
  });

  const balanceQueries = useQueries({
    queries: (items.data?.items ?? []).map((item) => {
      const params = { itemId: item.id, facilityId: filters.facilityId, departamentId: filters.departamentId, size: 100 };
      return {
        queryKey: ["stock", "balances", params],
        queryFn: () => stockService.balances(params),
      };
    }),
  });

  // mínimo da categoria vem do /by-category (buscando pelo nome)
  const summary = useQuery({
    queryKey: ["stock", "by-category", { name: category.data?.name, size: 100 }],
    queryFn: () => stockService.byCategory({ name: category.data!.name, size: 100 }),
    enabled: !!category.data,
  });
  // o valor do servidor ganha (muda quando edita a categoria aqui); o da navegação só cobre o carregamento
  const fromServer = summary.data?.items.find((c) => c.id === categoryId);
  const minimum = fromServer ? fromServer.minimum : nav.minimum;

  const rows: ItemTotal[] | undefined = useMemo(() => {
    if (!items.data) return undefined;
    return items.data.items
      .map((item, i) => {
        const q = balanceQueries[i];
        const balances = q?.data?.items ?? [];
        const quantity = balances.reduce((sum, b) => sum + (b.quantity ?? 0), 0);
        return { item, quantity, balances, loading: !q?.data };
      })
      .sort((a, b) => a.item.name.localeCompare(b.item.name, "pt-BR"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.data, balanceQueries]);

  const total = rows?.reduce((sum, r) => sum + r.quantity, 0) ?? 0;
  // o mínimo vale para a categoria inteira; com filtro de unidade/depto o total muda, então só avisa sem filtro
  const state = hasFilters || balanceQueries.some((q) => q.isLoading) ? "unknown" : categoryState({ quantity: total, minimum });
  const loadingTotals = balanceQueries.some((q) => q.isLoading);
  const error = category.error ?? items.error ?? balanceQueries.find((q) => q.error)?.error;

  // detalhe do item: cada saldo (unidade + departamento)
  const details = useQueries({
    queries: (selected?.balances ?? []).map((b) => ({
      queryKey: ["stock", "balance", b.id],
      queryFn: () => stockService.balance(b.id),
    })),
  });

  // editar/apagar o item direto no card ou na linha (sem abrir a janela de detalhes)
  const itemActions = (r: ItemTotal) =>
    canCatalog && (
      <div className="flex shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setItemForm({ id: r.item.id })} aria-label={`Editar ${r.item.name}`} title="Editar item" />
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 className="size-4" />}
          onClick={() => setDeleting({ kind: "item", id: r.item.id, name: r.item.name })}
          aria-label={`Apagar ${r.item.name}`}
          title="Apagar item"
        />
      </div>
    );

  const clearFilters = () => setParams(new URLSearchParams(), { replace: true });
  const empty = (
    <EmptyState
      icon={<PackageOpen className="size-5" />}
      title="Nenhum item nesta categoria"
      message="Crie o primeiro item desta categoria (ex.: Fonte Bluecase)."
      action={canCatalog ? <Button size="sm" icon={<PackagePlus className="size-4" />} onClick={() => setItemForm({})}>Novo item</Button> : undefined}
    />
  );


  return (
    <>
      <PageHeader
        back="/stock/balances"
        title={category.data?.name ?? "Categoria"}
        titleActions={
          canCatalog &&
          category.data && (
            <>
              <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setEditingCategory(true)}>
                Editar categoria
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-400 hover:text-red-300"
                icon={<Trash2 className="size-4" />}
                onClick={() => setDeleting({ kind: "category", id: category.data!.id, name: category.data!.name })}
              >
                Apagar
              </Button>
            </>
          )
        }
        description={
          loadingTotals || !rows
            ? "Carregando saldos..."
            : `${formatNumber(total)} em estoque em ${rows.length} ${rows.length === 1 ? "item" : "itens"}${hasFilters ? " (com os filtros)" : ""}${minimum != null ? ` · mínimo da categoria ${formatNumber(minimum)}` : ""}.`
        }
        actions={
          <>
            <ViewToggle value={view} onChange={setView} />
            {canCatalog && category.data && (
              <>
                <Button variant="secondary" icon={<PackagePlus className="size-4" />} onClick={() => setItemForm({})}>
                  Novo item
                </Button>
              </>
            )}
            {canWrite && (
              <Button icon={<Plus className="size-4" />} onClick={() => setMovement({ open: true })}>
                Nova movimentação
              </Button>
            )}
          </>
        }
      />
      {state === "below" && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border-2 border-red-500 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          <MinimumTag state="below" />
          <span>Faltam {formatNumber((minimum ?? 0) - total)} para chegar ao mínimo de {formatNumber(minimum ?? 0)}.</span>
        </div>
      )}
      {state === "at" && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border-2 border-amber-500 px-4 py-3 text-sm text-amber-200">
          <MinimumTag state="at" />
          <span>O total está exatamente no mínimo da categoria.</span>
        </div>
      )}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 p-4">
          <FacilitySelect className="w-full sm:w-52" placeholder="Todas as unidades" value={filters.facilityId} onChange={(e) => { setFilter("facilityId", e.target.value); setFilter("departamentId", ""); }} />
          <DepartamentSelect className="w-full sm:w-60" placeholder="Todos os departamentos" facilityId={filters.facilityId} value={filters.departamentId} onChange={(e) => setFilter("departamentId", e.target.value)} />
          {hasFilters && (
            <Button variant="ghost" icon={<FilterX className="size-4" />} onClick={clearFilters}>
              Limpar
            </Button>
          )}
        </div>
        {error ? (
          <div className="p-4"><ErrorState error={error} /></div>
        ) : view === "grid" ? (
          <CardGrid
            rows={rows}
            loading={items.isLoading}
            rowKey={(r) => r.item.id}
            empty={empty}
            renderCard={(r) => (
              <Tile onClick={() => setSelected(r)}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium text-slate-100">{r.item.name}</h3>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">SKU {r.item.sku}</p>
                  </div>
                  {itemActions(r)}
                </div>
                <div className="mt-auto flex items-end justify-between gap-3">
                  <span className="text-xs text-slate-400">
                    {r.balances.length} {r.balances.length === 1 ? "local" : "locais"}
                  </span>
                  <span className="text-right">
                    <span className={clsx("block text-3xl font-semibold leading-none tabular-nums", r.quantity === 0 ? "text-slate-500" : "text-slate-100")}>
                      {r.loading ? "…" : formatNumber(r.quantity)}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      em estoque
                    </span>
                  </span>
                </div>
              </Tile>
            )}
          />
        ) : (
          <Table
            rows={rows}
            loading={items.isLoading}
            rowKey={(r) => r.item.id}
            onRowClick={setSelected}
            empty={empty}
            columns={[
              { header: "Item", cell: (r) => <span className="font-medium text-slate-100">{r.item.name}</span> },
              { header: "SKU", cell: (r) => <span className="font-mono text-xs">{r.item.sku}</span> },
              { header: "Quantidade", className: "text-right", cell: (r) => <span className="font-semibold tabular-nums">{r.loading ? "…" : formatNumber(r.quantity)}</span> },
              ...(canCatalog ? [{ header: "", className: "w-px text-right", cell: (r: ItemTotal) => itemActions(r) }] : []),
            ]}
          />
        )}
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.item.name ?? ""}
        description={selected ? `${formatNumber(selected.quantity)} em estoque · onde está guardado` : undefined}
        footer={
          canCatalog &&
          selected && (
            <>
              <Button
                variant="ghost"
                className="text-red-400 hover:text-red-300"
                icon={<Trash2 className="size-4" />}
                onClick={() => {
                  setDeleting({ kind: "item", id: selected.item.id, name: selected.item.name });
                  setSelected(null);
                }}
              >
                Apagar item
              </Button>
              <Button
                variant="secondary"
                icon={<Pencil className="size-4" />}
                onClick={() => {
                  setItemForm({ id: selected.item.id });
                  setSelected(null);
                }}
              >
                Editar item
              </Button>
            </>
          )
        }
      >
        {selected && selected.balances.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Nenhum saldo deste item{hasFilters ? " com esses filtros" : ""}.</p>
        ) : (
          <div className="-mx-5 -my-4">
            <Table
              rows={selected?.balances}
              rowKey={(b) => b.id}
              columns={[
                { header: "Unidade", cell: (b) => b.facility?.name ?? "—" },
                {
                  header: "Departamento",
                  cell: (b) => details.find((d) => d.data?.id === b.id)?.data?.departament?.name ?? "…",
                },
                { header: "Quantidade", className: "text-right", cell: (b) => <span className="font-semibold tabular-nums">{formatNumber(b.quantity)}</span> },
                ...(canWrite
                  ? [
                      {
                        header: "",
                        className: "text-right",
                        cell: (b: StockBalanceSummaryResponse) => (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<ArrowRightLeft className="size-4" />}
                            onClick={() => {
                              setMovement({ open: true, from: b });
                              setSelected(null);
                            }}
                          >
                            Transferir
                          </Button>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        )}
      </Modal>

      <ItemModal
        open={!!itemForm}
        onClose={() => setItemForm(null)}
        id={itemForm?.id}
        category={category.data ? { id: category.data.id, name: category.data.name } : undefined}
      />
      <CategoryModal open={editingCategory} onClose={() => setEditingCategory(false)} id={categoryId} />
      <DeleteCatalogDialog
        kind={deleting?.kind ?? "item"}
        target={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => deleting?.kind === "category" && navigate("/stock/balances", { replace: true })}
      />

      <MovementModal
        open={movement.open}
        onClose={() => setMovement({ open: false })}
        initialKind={movement.from ? "transfer" : "entry"}
        fromBalance={movement.from}
      />
    </>
  );
}
