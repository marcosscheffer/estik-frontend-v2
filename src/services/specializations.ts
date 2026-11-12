import { api } from "@/lib/api";
import { cleanParams } from "@/lib/format";
import type { PageParams, PageResult, SpecializationResponse, UUID } from "@/types/api";

export interface SpecializationFilters extends PageParams {
  name?: string;
}

/** GET /specializations/** é para qualquer logado; criar e apagar exigem SYSTEM_MANAGE. */
export const specializationsService = {
  list: (params: SpecializationFilters = {}) =>
    api
      .get<PageResult<SpecializationResponse>>("/specializations", { params: cleanParams(params) })
      .then((r) => r.data),
  get: (id: UUID) => api.get<SpecializationResponse>(`/specializations/${id}`).then((r) => r.data),
  create: (name: string) =>
    api.post<SpecializationResponse>("/specializations", { name }).then((r) => r.data),
  remove: (id: UUID) => api.delete(`/specializations/${id}`).then(() => undefined),
};
