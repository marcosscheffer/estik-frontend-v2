import { api } from "@/lib/api";
import { cleanParams } from "@/lib/format";
import type {
  PageParams,
  PageResponse,
  PageResult,
  Role,
  UpdateUserRequest,
  UserFunction,
  UserResponse,
  UserResponseSummary,
  UUID,
} from "@/types/api";

export interface UserFilters extends PageParams {
  username?: string;
  facilityId?: UUID;
  role?: Role;
  function?: UserFunction;
}

export const usersService = {
  /** GET /users devolve { content, ... }; aqui vira { items, ... } como o resto da API. */
  list: (params: UserFilters): Promise<PageResult<UserResponseSummary>> =>
    api
      .get<PageResponse<UserResponseSummary>>("/users", { params: cleanParams(params) })
      .then(({ data: { content, ...rest } }) => ({ ...rest, items: content ?? [] })),
  get: (id: UUID) => api.get<UserResponse>(`/users/${id}`).then((r) => r.data),
  update: (id: UUID, body: UpdateUserRequest) =>
    api.put<UserResponse>(`/users/${id}`, body).then((r) => r.data),
  activate: (id: UUID) => api.post<UserResponse>(`/users/${id}/activate`).then((r) => r.data),
  deactivate: (id: UUID) => api.post<UserResponse>(`/users/${id}/deactivate`).then((r) => r.data),
  assign: (id: UUID, role: Role) =>
    api.post<UserResponse>(`/users/${id}/assign`, { role }).then((r) => r.data),
  changeFunction: (id: UUID, fn: UserFunction) =>
    api.post<UserResponse>(`/users/${id}/function`, { function: fn }).then((r) => r.data),
  changeFacility: (id: UUID, facilityId: UUID) =>
    api.post<UserResponse>(`/users/${id}/facility`, { facilityId }).then((r) => r.data),
};
