import type {
  Direction,
  MovementType,
  OsType,
  Role,
  StorageType,
  TicketPriority,
  TicketStatus,
  TicketType,
} from "@/types/api";
import { describeNotification, notificationRefId, type NotificationRef } from "@/lib/notifications";

export type Tone = "gray" | "blue" | "green" | "amber" | "red" | "violet";

export const roleLabel: Record<Role, string> = {
  USER: "Usuário",
  TECHNICIAN: "Técnico",
  ADMINISTRATOR: "Administrador",
};
export const roleTone: Record<Role, Tone> = {
  USER: "gray",
  TECHNICIAN: "amber",
  ADMINISTRATOR: "violet",
};

/** Rótulo curto do tipo de notificação (textos completos em lib/notifications.ts). */
export function notificationLabel(type: string): string {
  return describeNotification({ type }).label;
}
/** Todos os tipos atuais são de chamado: referenceId é o id do ticket. */
export function notificationLink(n: NotificationRef): string | undefined {
  const id = notificationRefId(n);
  if (!id) return undefined;
  return n.type === "NEW_TICKET" || n.type.startsWith("TICKET_") ? `/tickets/${id}` : undefined;
}

export const statusLabel: Record<TicketStatus, string> = {
  OPEN: "Aberto",
  FORWARDED: "Encaminhado",
  PROGRESS: "Em andamento",
  RESOLVED: "Resolvido",
  CANCELLED: "Cancelado",
};
export const statusTone: Record<TicketStatus, Tone> = {
  OPEN: "gray",
  FORWARDED: "violet",
  PROGRESS: "blue",
  RESOLVED: "green",
  CANCELLED: "red",
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
