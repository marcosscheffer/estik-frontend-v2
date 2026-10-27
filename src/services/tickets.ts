import { api } from "@/lib/api";
import { cleanParams } from "@/lib/format";
import type {
  CreateTicketRequest,
  PageParams,
  PageResult,
  TicketHistoryResponse,
  TicketPriority,
  TicketResponse,
  TicketStatus,
  TicketSummaryResponse,
  TicketType,
  UpdateTicketRequest,
  UUID,
} from "@/types/api";

export interface TicketFilters extends PageParams {
  title?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  type?: TicketType;
  facilityId?: UUID;
  requesterId?: UUID;
  assigneeId?: UUID;
}

export interface TicketHistoryFilters extends PageParams {
  status?: TicketStatus;
  type?: TicketType;
}

export type TicketAction = "assume" | "resolve" | "reopen" | "cancel";

export const ticketsService = {
  list: (params: TicketFilters) =>
    api
      .get<PageResult<TicketSummaryResponse>>("/tickets", { params: cleanParams(params) })
      .then((r) => r.data),
  get: (id: UUID) => api.get<TicketResponse>(`/tickets/${id}`).then((r) => r.data),
  create: (body: CreateTicketRequest) =>
    api.post<TicketResponse>("/tickets", body).then((r) => r.data),
  update: (id: UUID, body: UpdateTicketRequest) =>
    api.put<TicketResponse>(`/tickets/${id}`, body).then((r) => r.data),
  action: (id: UUID, action: TicketAction) =>
    api.post<TicketResponse>(`/tickets/${id}/${action}`).then((r) => r.data),
  remove: (id: UUID) => api.delete(`/tickets/${id}`),
  histories: (id: UUID, params: TicketHistoryFilters) =>
    api
      .get<PageResult<TicketHistoryResponse>>(`/tickets/${id}/histories`, {
        params: cleanParams(params),
      })
      .then((r) => r.data),
};
