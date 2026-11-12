import { api } from "@/lib/api";
import { cleanParams } from "@/lib/format";
import type { PageParams, PageResult, Permission, PermissionResponse, RoleResponse, UUID } from "@/types/api";

/** /access/** exige SYSTEM_MANAGE. */
export const accessService = {
  roles: (params: PageParams = {}) =>
    api.get<PageResult<RoleResponse>>("/access/roles", { params: cleanParams(params) }).then((r) => r.data),
  role: (id: UUID) => api.get<RoleResponse>(`/access/roles/${id}`).then((r) => r.data),
  createRole: (name: string) => api.post<RoleResponse>("/access/roles", { name }).then((r) => r.data),
  deleteRole: (id: UUID) => api.delete(`/access/roles/${id}`).then(() => undefined),

  permissions: (roleId: UUID) =>
    api.get<PermissionResponse[]>(`/access/permissions/role/${roleId}`).then((r) => r.data),
  addPermission: (roleId: UUID, permission: Permission) =>
    api.post<PermissionResponse>("/access/permissions", { roleId, permission }).then((r) => r.data),
  /** apaga pelo id da linha (PermissionResponse.id), não pelo nome da permissão */
  removePermission: (id: UUID) => api.delete(`/access/permissions/${id}`).then(() => undefined),
};
