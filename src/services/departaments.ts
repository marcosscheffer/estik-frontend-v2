import { api } from "@/lib/api";
import { cleanParams } from "@/lib/format";
import type {
  CreateDepartamentRequest,
  DepartamentResponse,
  DepartamentSummaryResponse,
  PageParams,
  PageResult,
  UpdateDepartamentRequest,
  UUID,
} from "@/types/api";

export interface DepartamentFilters extends PageParams {
  name?: string;
  code?: string;
  facilityId?: UUID;
}

export const departamentsService = {
  list: (params: DepartamentFilters) =>
    api
      .get<PageResult<DepartamentSummaryResponse>>("/departaments", { params: cleanParams(params) })
      .then((r) => r.data),
  get: (id: UUID) => api.get<DepartamentResponse>(`/departaments/${id}`).then((r) => r.data),
  create: (body: CreateDepartamentRequest) =>
    api.post<DepartamentResponse>("/departaments", body).then((r) => r.data),
  update: (id: UUID, body: UpdateDepartamentRequest) =>
    api.put<DepartamentResponse>(`/departaments/${id}`, body).then((r) => r.data),
  remove: (id: UUID) => api.delete(`/departaments/${id}`),
};
