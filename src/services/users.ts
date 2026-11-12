import { api } from "@/lib/api";
import { cleanParams } from "@/lib/format";
import type {
  PageParams,
  PageResponse,
  PageResult,
  UpdateUserRequest,
  UserResponse,
  UserResponseSummary,
  UUID,
} from "@/types/api";

export interface UserFilters extends PageParams {
  username?: string;
  facilityId?: UUID;
  roleId?: UUID;
  specializationId?: UUID;
}

export const usersService = {
  /** GET /users devolve { content, ... }; aqui vira { items, ... } como o resto da API. */
  list: (params: UserFilters): Promise<PageResult<UserResponseSummary>> =>
    api
      .get<PageResponse<UserResponseSummary>>("/users", { params: cleanParams(params) })
      .then(({ data: { content, ...rest } }) => ({ ...rest, items: content ?? [] })),
  get: (id: UUID) => api.get<UserResponse>(`/users/${id}`).then((r) => r.data),
  /** GET /users/me: qualquer logado (GET /users/{id} pede USER_MANAGE). */
  me: () => api.get<UserResponse>("/users/me").then((r) => r.data),
  update: (id: UUID, body: UpdateUserRequest) =>
    api.put<UserResponse>(`/users/${id}`, body).then((r) => r.data),
  activate: (id: UUID) => api.post<UserResponse>(`/users/${id}/activate`).then((r) => r.data),
  deactivate: (id: UUID) => api.post<UserResponse>(`/users/${id}/deactivate`).then((r) => r.data),
  /** troca o perfil (SYSTEM_MANAGE): o body leva o id do perfil no campo "role" */
  assign: (id: UUID, roleId: UUID) =>
    api.post<UserResponse>(`/users/${id}/assign`, { role: roleId }).then((r) => r.data),
  /** troca a área (USER_MANAGE); null tira a área. Vale no token a partir do próximo login. */
  changeSpecialization: (id: UUID, specializationId: UUID | null) =>
    api.post<UserResponse>(`/users/${id}/specialization`, { specializationId }).then((r) => r.data),
  changeFacility: (id: UUID, facilityId: UUID) =>
    api.post<UserResponse>(`/users/${id}/facility`, { facilityId }).then((r) => r.data),
};
