import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BellOff, CheckCheck } from "lucide-react";
import { useFilters } from "@/hooks/useFilters";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useMarkNotificationRead } from "@/hooks/useMarkNotificationRead";
import { notificationsService } from "@/services/notifications";
import { notificationLink } from "@/lib/labels";
import { groupByDay } from "@/lib/notifications";
import { Button, Card, ErrorState, PageHeader, PageLoader, Pagination } from "@/components/ui";
import { NotificationItem } from "@/components/NotificationItem";
import type { NotificationResponse } from "@/types/api";

export function NotificationsPage() {
  const navigate = useNavigate();
  const { page, setPage } = useFilters({});
  const { data, isLoading, error } = useQuery({
    queryKey: ["notifications", "list", { page, size: 20 }],
    queryFn: () => notificationsService.list({ page, size: 20 }),
    placeholderData: keepPreviousData,
  });
  const unread = useQuery({ queryKey: ["notifications", "unread"], queryFn: notificationsService.unread });
  const count = unread.data?.quantity ?? 0;

  const readOne = useMarkNotificationRead();
  const readAll = useApiMutation({
    mutationFn: notificationsService.readAll,
    invalidate: [["notifications"]],
    success: "Tudo marcado como lido",
  });

  // clicar marca como lida e abre o chamado
  const open = (n: NotificationResponse) => {
    if (!n.read) readOne.mutate(n.id);
    const to = notificationLink(n);
    if (to) navigate(to);
  };

  return (
    <>
      <PageHeader
        title="Notificações"
        description={count ? `Você tem ${count} ${count === 1 ? "notificação nova" : "notificações novas"}.` : "Tudo em dia."}
        actions={
          <Button variant="secondary" icon={<CheckCheck className="size-4" />} disabled={!count} loading={readAll.isPending} onClick={() => readAll.mutate()}>
            Marcar todas como lidas
          </Button>
        }
      />
      <Card className="overflow-hidden">
        {isLoading && <PageLoader />}
        {error && <div className="p-4"><ErrorState error={error} /></div>}
        {data?.items.length === 0 && (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-slate-800 text-slate-400">
              <BellOff className="size-6" />
            </span>
            <p className="mt-4 font-medium text-slate-200">Tudo em dia!</p>
            <p className="mt-1 text-sm text-slate-500">Nenhuma notificação.</p>
          </div>
        )}
        {data && groupByDay(data.items).map(({ group, items }) => (
          <section key={group}>
            <h2 className="border-b border-slate-800 bg-slate-900 px-5 pb-2 pt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {group}
            </h2>
            <ul className="divide-y divide-slate-800/70">
              {items.map((n) => (
                <li key={n.id}>
                  <NotificationItem n={n} large onClick={() => open(n)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
        {data && data.items.length > 0 && (
          <Pagination page={page} totalPages={data.totalPages} totalItems={data.totalItems} onChange={setPage} />
        )}
      </Card>
    </>
  );
}
