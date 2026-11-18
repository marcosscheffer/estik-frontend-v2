import { api } from "@/lib/api";
import { cleanParams } from "@/lib/format";
import type {
  MovementRequest,
  MovementType,
  PageParams,
  PageResult,
  StockBalanceResponse,
  StockBalanceSummaryResponse,
  StockCategoryResponse,
  StockMovementResponse,
  StockMovementSummaryResponse,
  TransferRequest,
  UUID,
} from "@/types/api";

export interface BalanceFilters extends PageParams {
  facilityId?: UUID;
  departamentId?: UUID;
  itemId?: UUID;
}
export interface CategoryBalanceFilters extends PageParams {
  name?: string;
}
export interface MovementFilters extends PageParams {
  facilityId?: UUID;
  departamentId?: UUID;
  type?: MovementType;
}

/** entry/exit/adjust compartilham o mesmo body (MovementRequest). */
export type SimpleMovement = "entry" | "exit" | "adjust";

export const stockService = {
  balances: (params: BalanceFilters) =>
    api
      .get<PageResult<StockBalanceSummaryResponse>>("/stock/balances", {
        params: cleanParams(params),
      })
      .then((r) => r.data),
  /** categorias com o total em estoque (soma de todas as unidades) */
  byCategory: (params: CategoryBalanceFilters) =>
    api
      .get<PageResult<StockCategoryResponse>>("/stock/balances/by-category", {
        params: cleanParams(params),
      })
      .then((r) => r.data),
  balance: (id: UUID) => api.get<StockBalanceResponse>(`/stock/balances/${id}`).then((r) => r.data),

  movements: (params: MovementFilters) =>
    api
      .get<PageResult<StockMovementSummaryResponse>>("/stock/movements", {
        params: cleanParams(params),
      })
      .then((r) => r.data),
  movement: (id: UUID) =>
    api.get<StockMovementResponse>(`/stock/movements/${id}`).then((r) => r.data),

  move: (kind: SimpleMovement, body: MovementRequest) =>
    api.post<StockMovementResponse>(`/stock/movements/${kind}`, body).then((r) => r.data),
  transfer: (body: TransferRequest) =>
    api.post<StockMovementResponse>("/stock/movements/transfer", body).then((r) => r.data),
};
