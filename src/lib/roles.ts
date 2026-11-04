import type { Role } from "@/types/api";

/**
 * Hierarquia igual à do RoleHierarchy do backend:
 * USER < TECHNICIAN < ADMINISTRATOR.
 * Quem tem um papel passa em qualquer checagem dos papéis abaixo dele.
 */
export const ROLES: readonly Role[] = ["USER", "TECHNICIAN", "ADMINISTRATOR"];
const rank: Record<Role, number> = { USER: 1, TECHNICIAN: 2, ADMINISTRATOR: 3 };

/** true se `userRole` é `min` ou está acima dele na hierarquia. */
export function hasRole(userRole: Role | undefined, min: Role): boolean {
  if (!userRole) return false;
  return rank[userRole] >= rank[min];
}

/**
 * Papel mínimo para cada área/ação. Isso é só UX: quem decide de
 * verdade é o SecurityConfig. Ajuste aqui se mudar as regras no backend.
 */
export const access = {
  tickets: "USER",
  // GET /computers e /histories liberam USER, mas criar/editar é TECHNICIAN;
  // a área inteira fica para técnicos para não mostrar telas cheias de 403.
  computers: "TECHNICIAN",
  histories: "TECHNICIAN",
  // /items e /categories exigem TECHNICIAN até no GET (o estoque usa esses lookups)
  stock: "TECHNICIAN",
  // entrada/saída/ajuste/transferência: TECHNICIAN na regra; hoje o backend só
  // libera ADMINISTRATOR porque o matcher "/stock/" não cobre /stock/movements/**
  stockWrite: "TECHNICIAN",
  catalog: "TECHNICIAN",
  // escrita em /facilities e /departaments cai no anyRequest -> ADMINISTRATOR
  facilities: "ADMINISTRATOR",
  departaments: "ADMINISTRATOR",
  // GET /users caiu no anyRequest -> ADMINISTRATOR (papel, unidade e ativação também)
  users: "ADMINISTRATOR",
  manageUsers: "ADMINISTRATOR",
  // triagem e encaminhamento: só administrador encaminha
  forwardTickets: "ADMINISTRATOR",
  // pode receber encaminhamento, assumir e resolver
  receiveTickets: "TECHNICIAN",
  deleteTickets: "ADMINISTRATOR",
} as const satisfies Record<string, Role>;

/** Papéis que podem receber um encaminhamento (o backend valida). */
export const FORWARD_TARGET_ROLES = ["TECHNICIAN", "ADMINISTRATOR"] as const satisfies readonly Role[];
