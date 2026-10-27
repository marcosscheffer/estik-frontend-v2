import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notificationsService } from "@/services/notifications";
import { getErrorMessage } from "@/lib/errors";
import type { NotificationResponse, PageResult, UnreadNotificationsResponse, UUID } from "@/types/api";

/**
 * Marca uma notificação como lida já atualizando a tela (sem esperar a API):
 * a bolinha some e o contador do sino diminui na hora. Se a API falhar,
 * volta ao estado anterior.
 */
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => notificationsService.read(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      // guarda o estado anterior para desfazer se der erro
      const lists = qc.getQueriesData<PageResult<NotificationResponse>>({ queryKey: ["notifications", "list"] });
      const unread = qc.getQueryData<UnreadNotificationsResponse>(["notifications", "unread"]);

      qc.setQueriesData<PageResult<NotificationResponse>>({ queryKey: ["notifications", "list"] }, (old) =>
        old && { ...old, items: old.items.map((n) => (n.id === id ? { ...n, read: true } : n)) },
      );
      qc.setQueryData<UnreadNotificationsResponse>(["notifications", "unread"], (old) =>
        old && { quantity: Math.max(0, old.quantity - 1) },
      );
      return { lists, unread };
    },
    onError: (err, _id, ctx) => {
      ctx?.lists.forEach(([key, data]) => qc.setQueryData(key, data));
      if (ctx?.unread) qc.setQueryData(["notifications", "unread"], ctx.unread);
      toast.error(getErrorMessage(err));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
