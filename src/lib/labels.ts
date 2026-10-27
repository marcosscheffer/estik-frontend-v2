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

export type Tone = "gray" | "blue" | "green" | "amber" | "red" | "violet";

export const roleLabel: Record<Role, string> = {
  USER: "Usuário",
  ARCH: "Arquitetura",
  IT: "TI",
};

export const statusLabel: Record<TicketStatus, string> = {
  OPEN: "Aberto",
  PROGRESS: "Em andamento",
  RESOLVED: "Resolvido",
  CANCELLED: "Cancelado",
};
export const statusTone: Record<TicketStatus, Tone> = {
  OPEN: "blue",
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
  ARCH: "Arquitetura",
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
