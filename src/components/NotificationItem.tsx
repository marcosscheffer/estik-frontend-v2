import clsx from "clsx";
import { formatDateTime, formatRelative } from "@/lib/format";
import { describeNotification, notificationTicketTitle } from "@/lib/notifications";
import type { NotificationResponse } from "@/types/api";

interface Props {
  n: NotificationResponse;
  onClick: () => void;
  /** tamanho maior na página de notificações */
  large?: boolean;
}

export function NotificationItem({ n, onClick, large }: Props) {
  // só o que vem na notificação, sem buscar o chamado
  const view = describeNotification(n);
  const ticket = notificationTicketTitle(n);
  const subtitle = ticket ? `#${ticket}` : view.fallbackText;
  const Icon = view.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "group relative flex w-full items-start gap-3 text-left transition-colors",
        large ? "px-5 py-4" : "px-4 py-3",
        n.read ? "hover:bg-slate-800/70" : "bg-slate-800/40 hover:bg-slate-800/80",
      )}
    >
      {/* faixa à esquerda marca as não lidas */}
      {!n.read && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-brand-500" aria-hidden />}
      <span
        className={clsx(
          "flex shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
          large ? "size-10" : "size-9",
          view.chip,
        )}
      >
        <Icon className={large ? "size-5" : "size-4"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span className={clsx("flex-1 text-sm leading-5", n.read ? "font-medium text-slate-300" : "font-semibold text-slate-100")}>
            {view.title}
          </span>
          <span className="shrink-0 pt-0.5 text-[11px] text-slate-500" title={formatDateTime(n.createdAt)}>
            {formatRelative(n.createdAt)}
          </span>
        </span>
        {subtitle && (
          <span className={clsx("mt-0.5 block truncate text-xs", n.read ? "text-slate-500" : "text-slate-400")}>{subtitle}</span>
        )}
      </span>
      {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-brand-500" aria-label="Não lida" />}
    </button>
  );
}
