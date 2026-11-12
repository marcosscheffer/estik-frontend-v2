import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { access, expandPermissions } from "@/lib/permissions";
import { accessService } from "@/services/access";
import type { Permission, RoleResponse, UUID } from "@/types/api";

/**
 * Perfis cadastrados (GET /access/roles). Só carrega para quem tem
 * SYSTEM_MANAGE; para os outros `data` fica vazio. O nome do perfil de cada
 * usuário já vem no próprio UserResponse (role.name).
 */
export function useRoles() {
  const { can } = useAuth();
  const enabled = can(access.roles);
  const query = useQuery({
    queryKey: ["access", "roles", "all"],
    queryFn: () => accessService.roles({ size: 100 }),
    enabled,
    staleTime: 60_000,
  });
  const roles = useMemo<RoleResponse[]>(
    () => [...(query.data?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [query.data],
  );
  const nameOf = useMemo(() => {
    const map = new Map(roles.map((r) => [r.id, r.name]));
    return (id: UUID | undefined) => (id ? map.get(id) : undefined);
  }, [roles]);
  return { ...query, enabled, roles, nameOf };
}

/** Nome legível do perfil: "TECHNICIAN" -> "Technician". */
export function prettyRole(name: string | undefined): string {
  if (!name) return "—";
  return name.charAt(0) + name.slice(1).toLowerCase().replace(/_/g, " ");
}

/**
 * Ids dos perfis que têm uma das permissões (ex.: quem pode receber
 * encaminhamento), contando as permissões incluídas. Undefined quando não dá para saber (sem SYSTEM_MANAGE).
 */
export function useRoleIdsWith(perms: readonly Permission[], enabledFlag = true) {
  const { roles, enabled } = useRoles();
  const results = useQueries({
    queries: roles.map((r) => ({
      queryKey: ["access", "permissions", r.id],
      queryFn: () => accessService.permissions(r.id),
      enabled: enabled && enabledFlag,
      staleTime: 60_000,
    })),
  });
  return useMemo(() => {
    if (!enabled || !roles.length || results.some((q) => !q.data)) return undefined;
    const ids = new Set<UUID>();
    roles.forEach((r, i) => {
      // conta as incluídas: quem tem TICKET_MANAGE também recebe encaminhamento
      const effective = expandPermissions(results[i].data!.map((p) => p.permission));
      if (perms.some((p) => effective.has(p))) ids.add(r.id);
    });
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, roles, results.map((q) => q.dataUpdatedAt).join(","), perms.join(",")]);
}
