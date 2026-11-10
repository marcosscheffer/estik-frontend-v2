import type { Permission } from "@/types/api";

/**
 * Espelho do PermissionEnum do backend (shared/domain/user/PermissionEnum.java).
 * Se criar ou renomear uma permissão lá, ajuste aqui também.
 *
 * Algumas permissões incluem outras (PermissionEnum.implied()). No banco fica
 * só o que foi marcado; no login o backend soma as incluídas e manda a lista
 * completa no token. IMPLIED abaixo é a cópia desse switch.
 */
export const IMPLIED: Partial<Record<Permission, Permission[]>> = {
  TICKET_WORK: ["TICKET_OPEN"],
  TICKET_SUPERVISOR: ["TICKET_OPEN", "TICKET_WORK"],
  TICKET_MANAGE: ["TICKET_OPEN", "TICKET_WORK"],
  STOCK_MANAGE: ["STOCK_READ"],
  COMPUTER_MANAGE: ["COMPUTER_READ"],
};

/** Mesmo que PermissionEnum.expand(): as marcadas + as que elas incluem. */
export function expandPermissions(perms: readonly Permission[]): Set<Permission> {
  const result = new Set<Permission>();
  for (const p of perms) {
    result.add(p);
    IMPLIED[p]?.forEach((i) => result.add(i));
  }
  return result;
}

/** Qual das permissões marcadas inclui `perm` (ou undefined). */
export function impliedBy(perm: Permission, granted: readonly Permission[]): Permission | undefined {
  return granted.find((g) => IMPLIED[g]?.includes(perm));
}

export type PermissionItem = { value: Permission; label: string; hint: string; note?: string };

export const PERMISSION_GROUPS: { title: string; items: PermissionItem[] }[] = [
  {
    title: "Chamados",
    items: [
      {
        value: "TICKET_OPEN",
        label: "Abrir chamados",
        hint: "Abre chamados e edita, cancela e reabre os chamados que abriu.",
      },
      {
        value: "TICKET_WORK",
        label: "Atender chamados",
        hint: "Tudo de Abrir chamados, e também recebe chamados encaminhados, assume e resolve.",
      },
      {
        value: "TICKET_SUPERVISOR",
        label: "Supervisionar chamados",
        hint: "Igual a Gerenciar chamados, mas só nos chamados da especialização dele: encaminha, apaga e lê a conversa. Inclui Atender e Abrir chamados.",
      },
      {
        value: "TICKET_MANAGE",
        label: "Gerenciar chamados",
        hint: "Tudo de Atender e Abrir chamados, e também encaminha para um técnico, apaga e lê a conversa de qualquer chamado, de todas as especializações (só lê: envia apenas quem participa).",
      },
    ],
  },
  {
    title: "Estoque",
    items: [
      {
        value: "STOCK_READ",
        label: "Ver estoque",
        hint: "Vê saldos, movimentações, itens e categorias. Não altera nada.",
      },
      {
        value: "STOCK_MANAGE",
        label: "Gerenciar estoque",
        hint: "Tudo de Ver estoque, e também registra entrada, saída, ajuste e transferência e cria, edita e apaga itens e categorias.",
      },
    ],
  },
  {
    title: "Computadores",
    items: [
      {
        value: "COMPUTER_READ",
        label: "Ver computadores",
        hint: "Vê o mapa, os computadores e o histórico de cada um. Não altera nada.",
      },
      {
        value: "COMPUTER_MANAGE",
        label: "Gerenciar computadores",
        hint: "Tudo de Ver computadores, e também cadastra, edita, move e apaga computadores e o histórico deles.",
      },
    ],
  },
  {
    title: "Administração",
    items: [
      {
        value: "FACILITY_MANAGE",
        label: "Unidades e departamentos",
        hint: "Vê, cria, edita e apaga unidades e departamentos. Sem ela a pessoa não vê nem a lista de unidades.",
      },
      {
        value: "USER_MANAGE",
        label: "Usuários",
        hint: "Lista usuários, ativa, desativa, muda o perfil e a unidade. Editar os próprios dados não precisa desta permissão.",
      },
      {
        value: "ACCESS_MANAGE",
        label: "Perfis e permissões",
        hint: "Cria e apaga perfis e liga ou desliga as permissões de cada um.",
        note: "É acesso total na prática: quem tem pode dar a si mesmo qualquer outra permissão.",
      },
    ],
  },
];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.value));

export const permissionLabel = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.value, i.label])),
) as Record<Permission, string>;

/** Uma permissão ou uma lista (basta ter uma delas). */
export type Need = Permission | readonly Permission[];

export function hasPermission(perms: readonly string[] | undefined, need: Need): boolean {
  if (!perms) return false;
  const list = typeof need === "string" ? [need] : need;
  return list.some((p) => perms.includes(p));
}

/**
 * Permissão necessária para cada área/ação. Isso é só UX: quem decide de
 * verdade é o SecurityConfig. Ajuste aqui se mudar as regras no backend.
 */
export const access = {
  // GET /tickets/** só pede login; quem não tem nenhuma permissão de chamado não vê o menu
  tickets: ["TICKET_OPEN", "TICKET_WORK", "TICKET_SUPERVISOR", "TICKET_MANAGE"],
  openTickets: "TICKET_OPEN",
  computers: "COMPUTER_READ",
  histories: "COMPUTER_READ",
  computerWrite: "COMPUTER_MANAGE",
  // /items e /categories estão junto com o estoque no SecurityConfig
  stock: "STOCK_READ",
  stockWrite: "STOCK_MANAGE",
  catalog: "STOCK_READ",
  catalogWrite: "STOCK_MANAGE",
  facilities: "FACILITY_MANAGE",
  departaments: "FACILITY_MANAGE",
  users: "USER_MANAGE",
  manageUsers: "USER_MANAGE",
  roles: "ACCESS_MANAGE",
  // triagem e encaminhamento
  // supervisor: só da especialização dele (o backend filtra); gerente: todos
  forwardTickets: ["TICKET_SUPERVISOR", "TICKET_MANAGE"],
  // pode receber encaminhamento, assumir e resolver
  receiveTickets: "TICKET_WORK",
  deleteTickets: ["TICKET_SUPERVISOR", "TICKET_MANAGE"],
  // lê a conversa de qualquer chamado (só leitura)
  superviseChats: ["TICKET_SUPERVISOR", "TICKET_MANAGE"],
} as const satisfies Record<string, Need>;
