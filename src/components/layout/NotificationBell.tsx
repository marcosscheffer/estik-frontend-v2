import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { notificationsService } from "@/services/notifications";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useMarkNotificationRead } from "@/hooks/useMarkNotificationRead";
import { notificationLink } from "@/lib/labels";
import { describeNotification, groupByDay, notificationRefId, notificationTicketTitle } from "@/lib/notifications";
import { streamSse } from "@/lib/sse";
import { NotificationItem } from "@/components/NotificationItem";
import type { NotificationStreamPayload, UnreadNotificationsResponse } from "@/types/api";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [live, setLive] = useState(false);

  const { data: unread } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: notificationsService.unread,
    // com o SSE no ar o contador vem por ele; o polling fica só de reserva
    refetchInterval: live ? false : 30_000,
  });

  // Tempo real: GET /notifications/stream manda "unread-count" ao conectar e
  // "notification" a cada notificação nova.
  useEffect(() => {
    const ctrl = new AbortController();
    streamSse("/notifications/stream", {
      signal: ctrl.signal,
      onOpen: () => setLive(true),
      onDisconnect: () => setLive(false),
      onFatal: () => setLive(false),
      onEvent: ({ event, data }) => {
        try {
          if (event === "unread-count") {
            qc.setQueryData<UnreadNotificationsResponse>(["notifications", "unread"], JSON.parse(data));
            return;
          }
          if (event !== "notification") return;
          const n = JSON.parse(data) as NotificationStreamPayload;
          qc.invalidateQueries({ queryKey: ["notifications"] });
          // a notificação é de chamado: atualiza listas/detalhe (ex.: "Encaminhados a mim")
          if (notificationRefId(n)) qc.invalidateQueries({ queryKey: ["tickets"] });

          const view = describeNotification(n);
          const to = notificationLink(n);
          const ticket = notificationTicketTitle(n);
          toast(view.title, {
            description: ticket ? `#${ticket}` : view.fallbackText,
            action: to ? { label: "Abrir", onClick: () => navigate(to) } : undefined,
          });
        } catch {
          /* evento malformado: ignora */
        }
      },
    }).finally(() => setLive(false));
    return () => ctrl.abort();
  }, [qc, navigate]);

  const { data: latest, isLoading } = useQuery({
    queryKey: ["notifications", "list", { page: 0, size: 8 }],
    queryFn: () => notificationsService.list({ page: 0, size: 8 }),
    enabled: open,
  });

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
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const count = unread?.quantity ?? 0;
  const items = latest?.items ?? [];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "relative rounded-lg p-2 transition-colors hover:bg-slate-800 hover:text-slate-200",
          open ? "bg-slate-800 text-slate-200" : "text-slate-500",
        )}
        aria-label={count ? `Notificações (${count} não lidas)` : "Notificações"}
        aria-expanded={open}
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-slate-950">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-40 overflow-hidden rounded-xl bg-slate-900 shadow-xl ring-1 ring-slate-700/70 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[380px]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-100">Notificações</span>
              {count > 0 && (
                <span className="rounded-full bg-brand-500/20 px-2 py-0.5 text-[11px] font-semibold text-brand-300">
                  {count} {count === 1 ? "nova" : "novas"}
                </span>
              )}
            </div>
            {count > 0 && (
              <button
                onClick={() => readAll.mutate()}
                disabled={readAll.isPending}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 disabled:opacity-50"
              >
                <CheckCheck className="size-3.5" /> Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-[min(28rem,70vh)] overflow-y-auto">
            {isLoading && (
              <ul className="space-y-1 p-3" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <li key={i} className="flex animate-pulse gap-3 px-1 py-2">
                    <span className="size-9 rounded-full bg-slate-800" />
                    <span className="flex-1 space-y-2 pt-1">
                      <span className="block h-3 w-3/4 rounded bg-slate-800" />
                      <span className="block h-2.5 w-1/2 rounded bg-slate-800" />
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {!isLoading && items.length === 0 && (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                  <BellOff className="size-5" />
                </span>
                <p className="mt-3 text-sm font-medium text-slate-200">Tudo em dia!</p>
                <p className="mt-1 text-xs text-slate-500">Nenhuma notificação.</p>
              </div>
            )}

            {groupByDay(items).map(({ group, items: list }) => (
              <section key={group}>
                <h3 className="sticky top-0 z-10 bg-slate-900 px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {group}
                </h3>
                <ul>
                  {list.map((n) => (
                    <li key={n.id}>
                      <NotificationItem
                        n={n}
                        onClick={() => {
                          if (!n.read) readOne.mutate(n.id);
                          const to = notificationLink(n);
                          if (to) {
                            setOpen(false);
                            navigate(to);
                          }
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-800 px-4 py-2.5 text-center text-sm font-medium text-brand-400 transition-colors hover:bg-slate-800 hover:text-brand-300"
          >
            Ver todas
          </Link>
        </div>
      )}
    </div>
  );
}
