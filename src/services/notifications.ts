import { api } from "@/lib/api";
import type {
  NotificationResponse,
  PageParams,
  PageResult,
  UnreadNotificationsResponse,
  UUID,
} from "@/types/api";

export const notificationsService = {
  list: (params: PageParams) =>
    api
      .get<PageResult<NotificationResponse>>("/notifications", { params })
      .then((r) => r.data),
  unread: () =>
    api.get<UnreadNotificationsResponse>("/notifications/unread").then((r) => r.data),
  read: (id: UUID) => api.patch(`/notifications/${id}/read`),
  readAll: () =>
    api.patch<UnreadNotificationsResponse>("/notifications/read").then((r) => r.data),
};
