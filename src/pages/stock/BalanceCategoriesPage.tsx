import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { FolderOpen, List, Plus, SearchX, Tags } from "lucide-react";
import { access } from "@/lib/permissions";
import { useAuth } from "@/contexts/AuthContext";
import { useFilters } from "@/hooks/useFilters";
import { useViewMode } from "@/hooks/useViewMode";
import { stockService } from "@/services/stock";
import { formatNumber } from "@/lib/format";
import { Button, Card, CardGrid, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Table, Tile, TileIcon, ViewToggle } from "@/components/ui";
import type { StockCategoryResponse } from "@/types/api";
import { MovementModal } from "./MovementModal";
import { MinimumTag } from "./BalanceCard";
import type { MinimumState } from "@/lib/stock";

/** Compara o total da categoria com o mínimo dela. */
export function categoryState(c: { quantity: number | null; minimum?: number | null }): MinimumState {
  if (c.minimum == null) return "unknown";
  const q = c.quantity ?? 0;
  if (q < c.minimum) return "below";
  if (q === c.minimum) return "at";
  return "ok";
}

/**
 * Saldos agrupados por categoria (GET /stock/balances/by-category).
 * Cada card mostra o total da categoria; ao clicar abre os itens dela.
 */
export function BalanceCategoriesPage() {
  const { can } = useAuth();
  const canWrite = can(access.stockWrite);
  const navigate = useNavigate();
  const { filters, page, setFilter, setPage } = useFilters({ name: "" });
  const [view, setView] = useViewMode("balance-categories");
  const [movementOpen, setMovementOpen] = useState(false);
  // filtro só nesta página (o backend não filtra por mínimo)
  const [onlyBelow, setOnlyBelow] = useState(false);

  const query = { ...filters, page, size: 20 };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["stock", "by-category", query],
    queryFn: () => stockService.byCategory(query),
    placeholderData: keepPreviousData,
  });

  const rows = onlyBelow ? data?.items.filter((c) => categoryState(c) === "below") : data?.items;
  // leva o mínimo junto: o GET /categories/{id} ainda não devolve esse campo
  const open = (c: StockCategoryResponse) =>
    navigate(`/stock/balances/category/${c.id}`, { state: { minimum: c.minimum ?? null, quantity: c.quantity ?? 0 } });

  const empty = filters.name ? (
    <EmptyState icon={<SearchX className="size-5" />} title="Nenhuma categoria encontrada" message={`Nenhuma categoria com "${filters.name}".`} />
  ) : (
    <EmptyState
      icon={<Tags className="size-5" />}
      title="Nenhuma categoria ainda"
      message="Cadastre categorias e itens no catálogo. O total de cada categoria aparece aqui depois da primeira entrada."
    />
  );

  return (
    <>
      <PageHeader
        title="Saldos de estoque"
        description="Total em estoque por categoria, somando todas as unidades. Clique numa categoria para ver os itens."
        actions={
          <>
            <ViewToggle value={view} onChange={setView} />
            <Button variant="secondary" icon={<List className="size-4" />} onClick={() => navigate("/stock/balances/all")}>
              Todos os saldos
            </Button>
            {canWrite && (
              <Button icon={<Plus className="size-4" />} onClick={() => setMovementOpen(true)}>
                Nova movimentação
              </Button>
            )}
          </>
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-800 p-4">
          <div className="w-full sm:w-72">
            <SearchInput value={filters.name} onChange={(v) => setFilter("name", v)} placeholder="Buscar categoria..." />
          </div>
          <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-slate-300" title="Filtra só as categorias desta página">
            <input type="checkbox" className="size-4 rounded border-slate-600 bg-slate-900 accent-red-500" checked={onlyBelow} onChange={(e) => setOnlyBelow(e.target.checked)} />
            Abaixo do mínimo (nesta página)
          </label>
        </div>
        {error ? (
          <div className="p-4"><ErrorState error={error} /></div>
        ) : view === "grid" ? (
          <CardGrid
            rows={rows}
            loading={isLoading || isFetching}
            rowKey={(c) => c.id}
            empty={empty}
            renderCard={(c) => (
              <Tile
                onClick={() => open(c)}
                className={clsx(
                  categoryState(c) === "below" && "border-2 border-red-500 bg-red-950/40",
                  categoryState(c) === "at" && "border-2 border-amber-500",
                )}
              >
                <MinimumTag state={categoryState(c)} />
                <div className="flex items-start gap-3">
                  <TileIcon icon={FolderOpen} className="bg-emerald-500/15 text-emerald-400" />
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-slate-100">{c.name}</h3>
                    {c.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{c.description}</p>}
                  </div>
                </div>
                <div className="mt-auto text-right">
                  <span className={clsx("block text-3xl font-semibold leading-none tabular-nums", categoryState(c) === "below" ? "text-red-300" : "text-slate-100")}>
                    {formatNumber(c.quantity ?? 0)}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    em estoque{c.minimum != null && <> · mín. {formatNumber(c.minimum)}</>}
                  </span>
                </div>
              </Tile>
            )}
          />
        ) : (
          <Table
            rows={rows}
            loading={isLoading || isFetching}
            rowKey={(c) => c.id}
            onRowClick={open}
            rowClassName={(c) =>
              categoryState(c) === "below"
                ? "bg-red-950/40 shadow-[inset_4px_0_0_0_theme(colors.red.500)]"
                : categoryState(c) === "at" && "shadow-[inset_4px_0_0_0_theme(colors.amber.500)]"
            }
            empty={empty}
            columns={[
              { header: "Categoria", cell: (c) => <span className="font-medium text-slate-100">{c.name}</span> },
              { header: "Descrição", cell: (c) => <span className="text-slate-400">{c.description || "—"}</span> },
              { header: "Situação", cell: (c) => <MinimumTag state={categoryState(c)} showOk /> },
              { header: "Mínimo", className: "text-right", cell: (c) => <span className="tabular-nums text-slate-400">{c.minimum != null ? formatNumber(c.minimum) : "—"}</span> },
              {
                header: "Em estoque",
                className: "text-right",
                cell: (c) => <span className={clsx("font-semibold tabular-nums", categoryState(c) === "below" && "text-red-300")}>{formatNumber(c.quantity ?? 0)}</span>,
              },
            ]}
          />
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} totalItems={data.totalItems} onChange={setPage} />}
      </Card>

      <MovementModal open={movementOpen} onClose={() => setMovementOpen(false)} initialKind="entry" />
    </>
  );
}
