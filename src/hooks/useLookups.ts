import { useQuery } from "@tanstack/react-query";
import { facilitiesService } from "@/services/facilities";
import { departamentsService } from "@/services/departaments";
import { categoriesService, itemsService } from "@/services/catalog";

// Listas usadas nos <select> dos formulários e filtros.
const LOOKUP_SIZE = 100;
const staleTime = 60_000;

export function useFacilityOptions(enabled = true) {
  return useQuery({
    queryKey: ["lookup", "facilities"],
    queryFn: () => facilitiesService.list({ size: LOOKUP_SIZE }),
    select: (d) => d.items.map((f) => ({ value: f.id, label: `${f.name} (${f.code})` })),
    staleTime,
    enabled,
  });
}

export function useDepartamentOptions(facilityId?: string) {
  return useQuery({
    queryKey: ["lookup", "departaments", facilityId ?? "all"],
    queryFn: () => departamentsService.list({ facilityId, size: LOOKUP_SIZE }),
    select: (d) => d.items.map((x) => ({ value: x.id, label: `${x.name} (${x.code})` })),
    staleTime,
  });
}

export function useCategoryOptions() {
  return useQuery({
    queryKey: ["lookup", "categories"],
    queryFn: () => categoriesService.list({ size: LOOKUP_SIZE }),
    select: (d) => d.items.map((c) => ({ value: c.id, label: c.name })),
    staleTime,
  });
}

export function useItemOptions() {
  return useQuery({
    queryKey: ["lookup", "items"],
    queryFn: () => itemsService.list({ size: LOOKUP_SIZE }),
    select: (d) => d.items.map((i) => ({ value: i.id, label: `${i.name} · ${i.sku}` })),
    staleTime,
  });
}
