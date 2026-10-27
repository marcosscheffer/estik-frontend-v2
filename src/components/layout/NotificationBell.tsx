import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCheck, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { notificationsService } from "@/services/notifications";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useMarkNotificationRead } from "@/hooks/useMarkNotificationRead";
import { formatDateTime, formatRelative } from "@/lib/format";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: unread } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: notificationsService.unread,
    refetchInterval: 30_000,
  });

  const { data: latest } = useQuery({
    queryKey: ["notifications", "list", { page: 0, size: 6 }],
    queryFn: () => notificationsService.list({ page: 0, size: 6 }),
    enabled: open,
  });

  const [expanded, setExpanded] = useState<string | null>(null);
  const readOne = useMarkNotificationRead();
  const readAll = useApiMutation({
    mutationFn: notificationsService.readAll,
    invalidate: [["notifications"]],
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const count = unread?.quantity ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
        aria-label="Notificações"
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl bg-slate-900 shadow-lg ring-1 ring-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <span className="text-sm font-semibold text-slate-100">Notificações</span>
            {count > 0 && (
              <button
                onClick={() => readAll.mutate()}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
              >
                <CheckCheck className="size-3.5" /> Marcar todas
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-slate-800/70 overflow-y-auto">
            {latest?.items.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma notificação.</li>
            )}
            {latest?.items.map((n) => {
              const isOpen = expanded === n.id;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => {
                      setExpanded(isOpen ? null : n.id);
                      if (!n.read) readOne.mutate(n.id);
                    }}
                    className={clsx(
                      "flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-800/60",
                      !n.read && "bg-brand-500/10",
                      isOpen && "bg-slate-800/40",
                    )}
                  >
                    <span
                      className={clsx("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand-500")}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={clsx("block text-sm font-medium text-slate-100", !isOpen && "truncate")}>{n.title}</span>
                      <span className={clsx("block text-xs text-slate-400", isOpen ? "whitespace-pre-wrap text-slate-300" : "line-clamp-2")}>
                        {n.message}
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-500" title={formatDateTime(n.createdAt)}>
                        {isOpen ? formatDateTime(n.createdAt) : formatRelative(n.createdAt)}
                      </span>
                    </span>
                    <ChevronDown className={clsx("mt-0.5 size-3.5 shrink-0 text-slate-500 transition-transform", isOpen && "rotate-180")} />
                  </button>
                </li>
              );
            })}
          </ul>
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-800 px-4 py-2.5 text-center text-sm font-medium text-brand-400 hover:bg-slate-800/60"
          >
            Ver todas
          </Link>
        </div>
      )}
    </div>
  );
}
