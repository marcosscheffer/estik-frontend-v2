import { queryOptions } from "@tanstack/react-query";
import { facilitiesService } from "@/services/facilities";
import { departamentsService } from "@/services/departaments";
import { computersService } from "@/services/computers";
import { stockService } from "@/services/stock";

// 100 é o máximo por página da API.
const MAX = 100;
const staleTime = 60_000;

/**
 * Consultas da tela de mapa. As chaves seguem o padrão das outras telas
 * (["computers", "list", query] etc.), então as mutations atuais invalidam o cache.
 */
export const mapQueries = {
  facilities: () =>
    queryOptions({
      queryKey: ["facilities", "list", { size: MAX }],
      queryFn: () => facilitiesService.list({ size: MAX }),
      staleTime,
    }),
  departaments: (facilityId: string) =>
    queryOptions({
      queryKey: ["departaments", "list", { facilityId, size: MAX }],
      queryFn: () => departamentsService.list({ facilityId, size: MAX }),
      staleTime,
    }),
  computers: (departamentId: string) =>
    queryOptions({
      queryKey: ["computers", "list", { departamentId, size: MAX }],
      queryFn: () => computersService.list({ departamentId, size: MAX }),
      staleTime,
    }),
  balances: (departamentId: string) =>
    queryOptions({
      queryKey: ["stock", "balances", { departamentId, size: MAX }],
      queryFn: () => stockService.balances({ departamentId, size: MAX }),
      staleTime,
    }),
  // size=1 só para ler o totalItems
  computerCount: (departamentId: string) =>
    queryOptions({
      queryKey: ["computers", "list", { departamentId, size: 1 }],
      queryFn: () => computersService.list({ departamentId, size: 1 }),
      staleTime,
    }),
  balanceCount: (departamentId: string) =>
    queryOptions({
      queryKey: ["stock", "balances", { departamentId, size: 1 }],
      queryFn: () => stockService.balances({ departamentId, size: 1 }),
      staleTime,
    }),
};
