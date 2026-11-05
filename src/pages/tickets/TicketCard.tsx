import { Link } from "react-router-dom";
import { Building2, Clock } from "lucide-react";
import clsx from "clsx";
import { formatRelative } from "@/lib/format";
import { priorityLabel, priorityTone, ticketTypeLabel } from "@/lib/labels";
import { Badge, StatusPill } from "@/components/ui";
import type { TicketPriority, TicketSummaryResponse } from "@/types/api";

const priorityBorder: Record<TicketPriority, string> = {
  URGENT: "border-l-red-500",
  MODERATE: "border-l-amber-500",
  MILD: "border-l-slate-600",
};

/** Card de chamado usado na lista de chamados e no início. */
export function TicketCard({ ticket: t }: { ticket: TicketSummaryResponse }) {
  // encerrado: sem a cor da prioridade na borda e com o título mais apagado
  const closed = t.status === "CANCELLED" || t.status === "RESOLVED";
  return (
    <Link
      to={`/tickets/${t.id}`}
      className={clsx(
        "flex h-full flex-col gap-3 rounded-xl border-l-4 bg-slate-800/40 p-4 ring-1 ring-slate-800 transition",
        "hover:-translate-y-0.5 hover:bg-slate-800/70 hover:ring-slate-700",
        "focus-visible:outline-2 focus-visible:outline-brand-600",
        closed ? "border-l-slate-700" : priorityBorder[t.priority],
      )}
    >
      {/* status sozinho à esquerda; prioridade e área como tags à direita */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusPill status={t.status} />
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={priorityTone[t.priority]}>{priorityLabel[t.priority]}</Badge>
          <Badge>{ticketTypeLabel[t.ticketType]}</Badge>
        </div>
      </div>
      <h3 className={clsx("line-clamp-2 font-medium", closed ? "text-slate-400" : "text-slate-100")}>{t.title}</h3>
      <div className="mt-auto flex items-center justify-between gap-3 text-xs text-slate-500">
        <span className="inline-flex min-w-0 items-center gap-1">
          <Building2 className="size-3.5 shrink-0" />
          <span className="truncate">{t.facility?.name ?? "—"}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1" title={t.createdAt}>
          <Clock className="size-3.5" />
          {formatRelative(t.createdAt)}
        </span>
      </div>
    </Link>
  );
}
