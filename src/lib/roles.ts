import type { Role } from "@/types/api";

/**
 * Hierarquia igual à do RoleHierarchy do backend: IT > ARCH > USER.
 * Quem tem IT também passa em qualquer checagem de ARCH e USER.
 */
const rank: Record<Role, number> = { USER: 1, ARCH: 2, IT: 3 };

export function hasRole(userRole: Role | undefined, required: Role): boolean {
  if (!userRole) return false;
  return rank[userRole] >= rank[required];
}

/**
 * Qual papel mínimo vê cada área do menu. Isso é só UX: quem decide de
 * verdade é o SecurityConfig. Ajuste aqui se mudar as regras no backend.
 */
export const access = {
  tickets: "USER",
  computers: "ARCH",
  histories: "ARCH",
  stock: "ARCH",
  catalog: "ARCH",
  facilities: "IT",
  departaments: "IT",
  users: "IT",
  assumeTickets: "ARCH",
} as const satisfies Record<string, Role>;
