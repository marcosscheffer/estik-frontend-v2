import { api } from "@/lib/api";
import { cleanParams } from "@/lib/format";
import type {
  FacilityRequest,
  FacilityResponse,
  FacilitySummaryResponse,
  PageParams,
  PageResult,
  UUID,
} from "@/types/api";

export interface FacilityFilters extends PageParams {
  q?: string;
}

export const facilitiesService = {
  list: (params: FacilityFilters) =>
    api
      .get<PageResult<FacilitySummaryResponse>>("/facilities", { params: cleanParams(params) })
      .then((r) => r.data),
  get: (id: UUID) => api.get<FacilityResponse>(`/facilities/${id}`).then((r) => r.data),
  create: (body: FacilityRequest) =>
    api.post<FacilitySummaryResponse>("/facilities", body).then((r) => r.data),
  update: (id: UUID, body: FacilityRequest) =>
    api.put<FacilityResponse>(`/facilities/${id}`, body).then((r) => r.data),
  remove: (id: UUID) => api.delete(`/facilities/${id}`),
};
