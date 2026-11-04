import type {
  Direction,
  MovementType,
  NotificationType,
  OsType,
  Role,
  UserFunction,
  StorageType,
  TicketPriority,
  TicketStatus,
  TicketType,
} from "@/types/api";

export type Tone = "gray" | "blue" | "green" | "amber" | "red" | "violet";

export const roleLabel: Record<Role, string> = {
  USER: "Usuário",
  REGULATOR: "Regulador",
  TECHNICIAN: "Técnico",
  ADMINISTRATOR: "Administrador",
};
export const roleTone: Record<Role, Tone> = {
  USER: "gray",
  REGULATOR: "blue",
  TECHNICIAN: "amber",
  ADMINISTRATOR: "violet",
};

export const functionLabel: Record<UserFunction, string> = {
  USER: "Usuário",
  IT: "TI",
  MAINTENANCE: "Manutenção",
};
export const functionTone: Record<UserFunction, Tone> = {
  USER: "gray",
  IT: "blue",
  MAINTENANCE: "green",
};

/** Tipos de notificação conhecidos; outros aparecem com o texto cru. */
export const notificationTypeLabel: Record<NotificationType, string> = {
  NEW_TICKET: "Novo chamado",
  TICKET_ASSUMED: "Assumido",
  TICKET_REOPEN: "Reaberto",
  TICKET_CANCELLED: "Cancelado",
  TICKET_RESOLVED: "Resolvido",
};
export function notificationLabel(type: string): string {
  return notificationTypeLabel[type as NotificationType] ?? type;
}
/** Todos os tipos atuais são de chamado: referencesId é o id do ticket. */
export function notificationLink(n: { type: string; referencesId?: string | null }): string | undefined {
  if (!n.referencesId) return undefined;
  return n.type === "NEW_TICKET" || n.type.startsWith("TICKET_") ? `/tickets/${n.referencesId}` : undefined;
}

export const statusLabel: Record<TicketStatus, string> = {
  OPEN: "Aberto",
  FORWARDED: "Encaminhado",
  PROGRESS: "Em andamento",
  RESOLVED: "Resolvido",
  CANCELLED: "Cancelado",
};
export const statusTone: Record<TicketStatus, Tone> = {
  OPEN: "blue",
  FORWARDED: "violet",
  PROGRESS: "amber",
  RESOLVED: "green",
  CANCELLED: "gray",
};

export const priorityLabel: Record<TicketPriority, string> = {
  MILD: "Leve",
  MODERATE: "Moderada",
  URGENT: "Urgente",
};
export const priorityTone: Record<TicketPriority, Tone> = {
  MILD: "gray",
  MODERATE: "amber",
  URGENT: "red",
};

export const ticketTypeLabel: Record<TicketType, string> = {
  IT: "TI",
  MAINTENANCE: "Manutenção",
};

export const osLabel: Record<OsType, string> = { WINDOWS: "Windows", UBUNTU: "Ubuntu" };
export const storageTypeLabel: Record<StorageType, string> = { NVME: "NVMe", SSD: "SSD", HDD: "HDD" };

export const directionLabel: Record<Direction, string> = {
  RECEIVED: "Recebido",
  SENT: "Enviado",
  NONE: "Nenhuma",
};
export const directionTone: Record<Direction, Tone> = {
  RECEIVED: "green",
  SENT: "blue",
  NONE: "gray",
};

export const movementLabel: Record<MovementType, string> = {
  IN: "Entrada",
  OUT: "Saída",
  TRANSFER: "Transferência",
  ADJUSTMENT: "Ajuste",
};
export const movementTone: Record<MovementType, Tone> = {
  IN: "green",
  OUT: "red",
  TRANSFER: "violet",
  ADJUSTMENT: "amber",
};

/** Transforma um Record de labels em opções para <Select>. */
export function toOptions<K extends string>(labels: Record<K, string>) {
  return (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));
}
