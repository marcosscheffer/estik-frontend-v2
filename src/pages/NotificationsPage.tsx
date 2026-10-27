import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CheckCheck, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { useFilters } from "@/hooks/useFilters";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useMarkNotificationRead } from "@/hooks/useMarkNotificationRead";
import { notificationsService } from "@/services/notifications";
import { formatDateTime, formatRelative } from "@/lib/format";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, PageLoader, Pagination } from "@/components/ui";
import type { NotificationResponse } from "@/types/api";

export function NotificationsPage() {
  const { page, setPage } = useFilters({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["notifications", "list", { page, size: 20 }],
    queryFn: () => notificationsService.list({ page, size: 20 }),
    placeholderData: keepPreviousData,
  });
  const unread = useQuery({ queryKey: ["notifications", "unread"], queryFn: notificationsService.unread });

  const readOne = useMarkNotificationRead();
  const readAll = useApiMutation({
    mutationFn: notificationsService.readAll,
    invalidate: [["notifications"]],
    success: "Tudo marcado como lido",
  });

  // abrir uma notificação já marca como lida
  const toggle = (n: NotificationResponse) => {
    setExpanded((cur) => (cur === n.id ? null : n.id));
    if (!n.read) readOne.mutate(n.id);
  };

  return (
    <>
      <PageHeader
        title="Notificações"
        description={unread.data ? `${unread.data.quantity} não lida(s) · clique numa notificação para abrir` : undefined}
        actions={
          <Button variant="secondary" icon={<CheckCheck className="size-4" />} disabled={!unread.data?.quantity} loading={readAll.isPending} onClick={() => readAll.mutate()}>
            Marcar todas como lidas
          </Button>
        }
      />
      <Card>
        {isLoading && <PageLoader />}
        {error && <div className="p-4"><ErrorState error={error} /></div>}
        {data?.items.length === 0 && <EmptyState message="Você não tem notificações." />}
        <ul className="divide-y divide-slate-800/70">
          {data?.items.map((n) => {
            const isOpen = expanded === n.id;
            const panelId = `notification-${n.id}`;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => toggle(n)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className={clsx(
                    "flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-800/50",
                    !n.read && "bg-brand-500/10",
                    isOpen && "bg-slate-800/40",
                  )}
                >
                  <span
                    className={clsx("mt-2 size-2 shrink-0 rounded-full transition-colors", n.read ? "bg-slate-700" : "bg-brand-500")}
                    aria-label={n.read ? "Lida" : "Não lida"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={clsx("text-slate-100", n.read ? "font-normal" : "font-semibold")}>{n.title}</p>
                      {n.type && <Badge>{n.type}</Badge>}
                    </div>
                    {!isOpen && <p className="mt-0.5 line-clamp-1 text-sm text-slate-400">{n.message}</p>}
                    {/* grid-rows anima a altura sem medir o conteúdo */}
                    <div
                      id={panelId}
                      className={clsx("grid transition-[grid-template-rows] duration-200", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
                    >
                      <div className="overflow-hidden">
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{n.message}</p>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-500" title={formatDateTime(n.createdAt)}>
                      {isOpen ? formatDateTime(n.createdAt) : formatRelative(n.createdAt)}
                    </p>
                  </div>
                  <ChevronDown className={clsx("mt-1 size-4 shrink-0 text-slate-500 transition-transform", isOpen && "rotate-180")} />
                </button>
              </li>
            );
          })}
        </ul>
        {data && <Pagination page={page} totalPages={data.totalPages} totalItems={data.totalItems} onChange={setPage} />}
      </Card>
    </>
  );
}
