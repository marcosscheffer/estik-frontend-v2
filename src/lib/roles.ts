import type { Role, TicketType, UserFunction } from "@/types/api";

/**
 * Hierarquia igual à do RoleHierarchy do backend:
 * ADMINISTRATOR > TECHNICIAN > REGULATOR > USER.
 * Quem tem um papel passa em qualquer checagem dos papéis abaixo dele.
 */
const rank: Record<Role, number> = { USER: 1, REGULATOR: 2, TECHNICIAN: 3, ADMINISTRATOR: 4 };

export function hasRole(userRole: Role | undefined, required: Role): boolean {
  if (!userRole) return false;
  return rank[userRole] >= rank[required];
}

/**
 * Qual papel mínimo vê cada área/ação. Isso é só UX: quem decide de
 * verdade é o SecurityConfig. Ajuste aqui se mudar as regras no backend.
 */
export const access = {
  tickets: "USER",
  // GET /computers e /histories estão liberados para USER, mas criar/editar é TECHNICIAN;
  // a área inteira fica para técnicos para não mostrar telas cheias de 403.
  computers: "TECHNICIAN",
  histories: "TECHNICIAN",
  // /items e /categories exigem TECHNICIAN até no GET (o estoque usa esses lookups).
  stock: "TECHNICIAN",
  catalog: "TECHNICIAN",
  // escrita em /facilities e /departaments cai no anyRequest -> ADMINISTRATOR
  facilities: "ADMINISTRATOR",
  departaments: "ADMINISTRATOR",
  // GET /users exige REGULATOR; papel, função, unidade e ativação são ADMINISTRATOR
  users: "REGULATOR",
  manageUsers: "ADMINISTRATOR",
  // quem trabalha com chamados (regulador, técnico, admin); quem encaminha e
  // o que o técnico vê ficam em canForwardTickets / seesOnlyForwardedTickets abaixo
  ticketStaff: "REGULATOR",
  deleteTickets: "ADMINISTRATOR",
} as const satisfies Record<string, Role>;

/**
 * Regras de chamado decididas só no front (o backend não restringe hoje):
 * - quem encaminha é REGULATOR ou ADMINISTRATOR; TECHNICIAN não encaminha,
 *   mesmo estando acima de REGULATOR na hierarquia.
 * - TECHNICIAN só enxerga os chamados encaminhados a ele (e os que ele abriu).
 */
export function canForwardTickets(role: Role | undefined): boolean {
  return role === "REGULATOR" || role === "ADMINISTRATOR";
}
export function seesOnlyForwardedTickets(role: Role | undefined): boolean {
  return role === "TECHNICIAN";
}
/** Pode receber encaminhamento (e assumir). */
export function receivesTickets(role: Role | undefined): boolean {
  return role === "TECHNICIAN" || role === "ADMINISTRATOR";
}

/** Área de chamado que corresponde à função do usuário (USER não tem área). */
export function ticketTypeOf(fn: UserFunction | undefined): TicketType | undefined {
  return fn === "IT" || fn === "MAINTENANCE" ? fn : undefined;
}
