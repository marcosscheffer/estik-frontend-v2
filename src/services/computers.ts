import { api } from "@/lib/api";
import { cleanParams } from "@/lib/format";
import type {
  ComputerHistoryResponse,
  ComputerHistorySummaryResponse,
  ComputerResponse,
  ComputerSummaryResponse,
  CreateComputerRequest,
  Direction,
  MoveComputerRequest,
  PageParams,
  PageResult,
  UpdateComputerRequest,
  UUID,
} from "@/types/api";

export interface ComputerFilters extends PageParams {
  name?: string;
  facilityId?: UUID;
  departamentId?: UUID;
}

export interface HistoryFilters extends PageParams {
  direction?: Direction;
  computerId?: UUID;
  departamentId?: UUID;
}

export const computersService = {
  list: (params: ComputerFilters) =>
    api
      .get<PageResult<ComputerSummaryResponse>>("/computers", { params: cleanParams(params) })
      .then((r) => r.data),
  get: (id: UUID) => api.get<ComputerResponse>(`/computers/${id}`).then((r) => r.data),
  create: (body: CreateComputerRequest) =>
    api.post<ComputerResponse>("/computers", body).then((r) => r.data),
  update: (id: UUID, body: UpdateComputerRequest) =>
    api.put<ComputerResponse>(`/computers/${id}`, body).then((r) => r.data),
  move: (id: UUID, body: MoveComputerRequest) =>
    api.post<ComputerResponse>(`/computers/${id}/move`, body).then((r) => r.data),
  remove: (id: UUID) => api.delete(`/computers/${id}`),
};

export const historiesService = {
  list: (params: HistoryFilters) =>
    api
      .get<PageResult<ComputerHistorySummaryResponse>>("/histories", { params: cleanParams(params) })
      .then((r) => r.data),
  get: (id: UUID) => api.get<ComputerHistoryResponse>(`/histories/${id}`).then((r) => r.data),
};
