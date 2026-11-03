import { api } from "@/lib/api";
import { cleanParams } from "@/lib/format";
import type {
  CreateTicketRequest,
  ForwardTicketRequest,
  PageParams,
  TicketMessageResponse,
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
  regulatorId?: UUID;
  forwardedId?: UUID;
  /** false = só os que ainda não foram encaminhados */
  forwarded?: boolean;
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
  /** Encaminha para um técnico; volta para OPEN e limpa o responsável. */
  forward: (id: UUID, body: ForwardTicketRequest) =>
    api.post<TicketResponse>(`/tickets/${id}/forward`, body).then((r) => r.data),
  remove: (id: UUID) => api.delete(`/tickets/${id}`),
  /** Mensagens do chat, da mais nova para a mais antiga. */
  messages: (id: UUID, params: PageParams) =>
    api
      .get<PageResult<TicketMessageResponse>>(`/tickets/${id}/messages`, { params: cleanParams(params) })
      .then((r) => r.data),
  sendMessage: (id: UUID, body: string) =>
    api.post<TicketMessageResponse>(`/tickets/${id}/messages`, { body }).then((r) => r.data),
  histories: (id: UUID, params: TicketHistoryFilters) =>
    api
      .get<PageResult<TicketHistoryResponse>>(`/tickets/${id}/histories`, {
        params: cleanParams(params),
      })
      .then((r) => r.data),
};
