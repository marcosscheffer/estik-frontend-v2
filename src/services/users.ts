import { api } from "@/lib/api";
import { cleanParams } from "@/lib/format";
import type {
  PageParams,
  PageResponse,
  Role,
  UpdateUserRequest,
  UserResponse,
  UserResponseSummary,
  UUID,
} from "@/types/api";

export interface UserFilters extends PageParams {
  username?: string;
  facilityId?: UUID;
}

export const usersService = {
  list: (params: UserFilters) =>
    api
      .get<PageResponse<UserResponseSummary>>("/users", { params: cleanParams(params) })
      .then((r) => r.data),
  get: (id: UUID) => api.get<UserResponse>(`/users/${id}`).then((r) => r.data),
  update: (id: UUID, body: UpdateUserRequest) =>
    api.put<UserResponse>(`/users/${id}`, body).then((r) => r.data),
  activate: (id: UUID) => api.post<UserResponse>(`/users/${id}/activate`).then((r) => r.data),
  deactivate: (id: UUID) => api.post<UserResponse>(`/users/${id}/deactivate`).then((r) => r.data),
  assign: (id: UUID, role: Role) =>
    api.post<UserResponse>(`/users/${id}/assign`, { role }).then((r) => r.data),
  changeFacility: (id: UUID, facilityId: UUID) =>
    api.post<UserResponse>(`/users/${id}/facility`, { facilityId }).then((r) => r.data),
};
