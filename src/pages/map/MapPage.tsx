import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { mapQueries } from "@/hooks/useMapQueries";
import { Button, Card, ErrorState, PageHeader, PageLoader, SearchInput } from "@/components/ui";
import { FacilityNode, MapContext, nodeKey, nodeStyle } from "./MapTree";
import { MapDetail } from "./MapDetail";

const legend = [
  { type: "f", label: "Unidade" },
  { type: "d", label: "Departamento" },
  { type: "c", label: "Computador" },
  { type: "b", label: "Item em estoque" },
] as const;

export function MapPage() {
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");

  // o nó selecionado fica na URL (?sel=d:<id>) para sobreviver ao recarregar
  const selected = params.get("sel");
  const select = useCallback(
    (key: string) => setParams({ sel: key }, { replace: true }),
    [setParams],
  );

  const facilities = useQuery(mapQueries.facilities());

  const toggle = useCallback((key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const open = useCallback((key: string) => setOpenKeys((prev) => new Set(prev).add(key)), []);

  /** Só abre o que já tem os filhos em cache: não dispara requisição nenhuma. */
  const expandAll = () => {
    const next = new Set(openKeys);
    for (const f of facilities.data?.items ?? []) {
      const deps = client.getQueryData(mapQueries.departaments(f.id).queryKey);
      if (!deps) continue;
      next.add(nodeKey("f", f.id));
      for (const d of deps.items) {
        const loaded =
          client.getQueryData(mapQueries.computers(d.id).queryKey) &&
          client.getQueryData(mapQueries.balances(d.id).queryKey);
        if (loaded) next.add(nodeKey("d", d.id));
      }
    }
    setOpenKeys(next);
  };

  const state = useMemo(
    () => ({
      query: query.trim().toLowerCase(),
      isOpen: (key: string) => openKeys.has(key),
      toggle,
      open,
      selected,
      select,
    }),
    [query, openKeys, toggle, open, selected, select],
  );

  return (
    <MapContext.Provider value={state}>
      <PageHeader
        title="Mapa"
        description="Onde cada coisa está: unidades, seus departamentos e o que há em cada um."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-4">
            <div className="min-w-48 flex-1">
              <SearchInput value={query} onChange={setQuery} placeholder="Buscar unidade, departamento, computador ou item" />
            </div>
            <Button variant="secondary" size="sm" icon={<ChevronsUpDown className="size-4" />} onClick={expandAll} title="Abre só o que já foi carregado">
              Expandir tudo
            </Button>
            <Button variant="secondary" size="sm" icon={<ChevronsDownUp className="size-4" />} onClick={() => setOpenKeys(new Set())}>
              Recolher tudo
            </Button>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-800 px-4 py-2 text-xs text-slate-500">
            {legend.map(({ type, label }) => {
              const { icon: Icon, color } = nodeStyle[type];
              return (
                <span key={type} className="inline-flex items-center gap-1.5">
                  <Icon className={`size-3.5 ${color}`} /> {label}
                </span>
              );
            })}
            {state.query && <span className="ml-auto">A busca olha só o que já foi aberto no mapa.</span>}
          </div>

          <div role="tree" aria-label="Mapa de unidades" className="p-2">
            {facilities.error ? (
              <div className="p-2"><ErrorState error={facilities.error} /></div>
            ) : facilities.isLoading ? (
              <PageLoader />
            ) : !facilities.data?.items.length ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500">Nenhuma unidade cadastrada.</p>
            ) : (
              facilities.data.items.map((f) => <FacilityNode key={f.id} facility={f} />)
            )}
          </div>
        </Card>

        <Card className="lg:sticky lg:top-6">
          <MapDetail selected={selected} onSelect={select} />
        </Card>
      </div>
    </MapContext.Provider>
  );
}
