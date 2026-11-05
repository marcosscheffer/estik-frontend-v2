import { Ban, CheckCircle2, CircleDot, Clock, Send, type LucideIcon } from "lucide-react";
import clsx from "clsx";
import { statusLabel } from "@/lib/labels";
import type { TicketStatus } from "@/types/api";

/**
 * Status do chamado. Tem formato próprio (pílula redonda + ícone) para não
 * ser confundido com as tags de prioridade/área, que são retangulares.
 */
const styles: Record<TicketStatus, { icon: LucideIcon; cls: string }> = {
  OPEN: { icon: CircleDot, cls: "bg-slate-800 text-slate-200 ring-slate-600" },
  FORWARDED: { icon: Send, cls: "bg-violet-950 text-violet-200 ring-violet-800" },
  PROGRESS: { icon: Clock, cls: "bg-sky-950 text-sky-200 ring-sky-700" },
  RESOLVED: { icon: CheckCircle2, cls: "bg-emerald-950 text-emerald-200 ring-emerald-800" },
  CANCELLED: { icon: Ban, cls: "bg-rose-950 text-rose-200 ring-rose-800" },
};

export function StatusPill({ status, size = "sm" }: { status: TicketStatus; size?: "sm" | "md" }) {
  const { icon: Icon, cls } = styles[status];
  return (
    <span
      title={`Status: ${statusLabel[status]}`}
      className={clsx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset",
        size === "md" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs",
        cls,
      )}
    >
      <Icon className={size === "md" ? "size-4" : "size-3.5"} aria-hidden />
      {statusLabel[status]}
    </span>
  );
}
