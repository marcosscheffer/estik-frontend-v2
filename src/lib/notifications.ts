import { Bell, CheckCircle2, Hand, MessageSquare, Plus, RotateCcw, Send, XCircle, type LucideIcon } from "lucide-react";

/**
 * O backend grava título e texto em inglês (e às vezes UUIDs crus, como
 * "assumed by <uuid>"). Por isso o texto mostrado é montado aqui, a partir
 * do `type`. O título do chamado vem no próprio payload (referenceLabel),
 * sem requisição extra.
 */
export interface NotificationKind {
  /** título curto, em português */
  title: string;
  /** rótulo do tipo (badge/filtro) */
  label: string;
  icon: LucideIcon;
  /** círculo do ícone: fundo sólido + cor do ícone */
  chip: string;
}

const kinds: Record<string, NotificationKind> = {
  TICKET_CREATED: { title: "Novo chamado aberto", label: "Novo chamado", icon: Plus, chip: "bg-sky-950 text-sky-300 ring-sky-800" },
  // vai para o solicitante E para o técnico com o mesmo type: sem como saber quem está vendo, texto neutro
  TICKET_FORWARDED: { title: "Chamado encaminhado", label: "Encaminhado", icon: Send, chip: "bg-violet-950 text-violet-300 ring-violet-800" },
  TICKET_ASSUMED: { title: "Seu chamado foi assumido", label: "Assumido", icon: Hand, chip: "bg-amber-950 text-amber-300 ring-amber-800" },
  TICKET_RESOLVED: { title: "Chamado resolvido", label: "Resolvido", icon: CheckCircle2, chip: "bg-emerald-950 text-emerald-300 ring-emerald-800" },
  TICKET_REOPENED: { title: "Chamado reaberto", label: "Reaberto", icon: RotateCcw, chip: "bg-orange-950 text-orange-300 ring-orange-800" },
  TICKET_CANCELLED: { title: "Chamado cancelado", label: "Cancelado", icon: XCircle, chip: "bg-rose-950 text-rose-300 ring-rose-800" },
  // se o backend separar o aviso do técnico em outro type
  TICKET_FORWARDED_TO_YOU: { title: "Chamado encaminhado para você", label: "Encaminhado", icon: Send, chip: "bg-violet-950 text-violet-300 ring-violet-800" },
  TICKET_MESSAGE: { title: "Nova mensagem no chamado", label: "Mensagem", icon: MessageSquare, chip: "bg-cyan-950 text-cyan-300 ring-cyan-800" },
};
// nomes antigos no backend
kinds.TICKET_REOPEN = kinds.TICKET_REOPENED;
kinds.NEW_TICKET = kinds.TICKET_CREATED;

const fallbackChip = "bg-slate-800 text-slate-300 ring-slate-700";

export interface NotificationView extends NotificationKind {
  /** false quando o tipo é desconhecido e o texto é o que veio do backend */
  known: boolean;
  /** texto de apoio quando não há título do chamado (tipo desconhecido) */
  fallbackText?: string;
}

export function describeNotification(n: { type: string; title?: string; message?: string | null }): NotificationView {
  const kind = kinds[n.type];
  if (kind) return { ...kind, known: true };
  return {
    title: n.title || "Aviso",
    label: "Aviso",
    icon: Bell,
    chip: fallbackChip,
    known: false,
    fallbackText: n.message ?? undefined,
  };
}

/** Pega o título que o backend coloca entre aspas simples ("Ticket 'X' reopened"). */
export function ticketTitleFromMessage(message?: string | null): string | undefined {
  return message?.match(/'([^']+)'/)?.[1];
}

export interface NotificationRef {
  type: string;
  referenceId?: string | null;
  referencesId?: string | null;
}
/** id do chamado (aceita o nome antigo referencesId). */
export function notificationRefId(n: NotificationRef): string | undefined {
  return n.referenceId ?? n.referencesId ?? undefined;
}

/** Título do chamado: referenceLabel; nas antigas, o nome entre aspas da mensagem. */
export function notificationTicketTitle(n: { referenceLabel?: string | null; message?: string | null }): string | undefined {
  return n.referenceLabel || ticketTitleFromMessage(n.message);
}

export type DayGroup = "Hoje" | "Ontem" | "Anteriores";

export function dayGroup(iso: string, now = new Date()): DayGroup {
  const d = new Date(iso);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= start) return "Hoje";
  if (d.getTime() >= start - 86_400_000) return "Ontem";
  return "Anteriores";
}

/** Agrupa mantendo a ordem (a lista já vem da mais nova para a mais antiga). */
export function groupByDay<T extends { createdAt: string }>(items: T[]): { group: DayGroup; items: T[] }[] {
  const out: { group: DayGroup; items: T[] }[] = [];
  for (const it of items) {
    const g = dayGroup(it.createdAt);
    const last = out[out.length - 1];
    if (last?.group === g) last.items.push(it);
    else out.push({ group: g, items: [it] });
  }
  return out;
}
