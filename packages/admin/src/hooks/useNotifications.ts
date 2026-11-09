import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';

export type NotificationType =
  | 'feedback.created'
  | 'feedback.assigned'
  | 'feedback.status_changed'
  | 'feedback.comment';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  feedback_id?: string | null;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationPage {
  items: NotificationItem[];
  page: number;
  page_size: number;
  total: number;
  unread_count: number;
}

type UnreadCount = { count: number };

const NOTIFICATIONS_KEY = ['notifications'] as const;
const LIST_KEY = [...NOTIFICATIONS_KEY, 'list'] as const;
const UNREAD_COUNT_KEY = [...NOTIFICATIONS_KEY, 'unread-count'] as const;

/** The panel shows the newest 20 notifications; older ones are left to a future full-page view. */
const PAGE_SIZE = 20;

export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () =>
      apiRequest<NotificationPage>(`/org/notifications?page=1&page_size=${PAGE_SIZE}`),
    enabled,
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: () => apiRequest<UnreadCount>('/org/notifications/unread-count'),
    // The shell keeps the badge fresh; opening the panel invalidates this on demand.
    refetchInterval: 60_000,
  });
}

type OptimisticSnapshot = {
  previousPage: NotificationPage | undefined;
  previousCount: UnreadCount | undefined;
};

function markLocallyRead(
  page: NotificationPage,
  matches: (item: NotificationItem) => boolean,
): NotificationPage {
  const readAt = new Date().toISOString();
  let changed = 0;
  const items = page.items.map((item) => {
    if (!matches(item) || item.read_at) return item;
    changed += 1;
    return { ...item, read_at: readAt };
  });
  if (changed === 0) return page;
  return { ...page, items, unread_count: Math.max(0, page.unread_count - changed) };
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ updated: boolean }>(`/org/notifications/${id}/read`, { method: 'POST' }),
    onMutate: async (id): Promise<OptimisticSnapshot> => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const previousPage = queryClient.getQueryData<NotificationPage>(LIST_KEY);
      const previousCount = queryClient.getQueryData<UnreadCount>(UNREAD_COUNT_KEY);
      if (previousPage) {
        const wasUnread = previousPage.items.some((item) => item.id === id && !item.read_at);
        const nextPage = markLocallyRead(previousPage, (item) => item.id === id);
        queryClient.setQueryData(LIST_KEY, nextPage);
        if (wasUnread && previousCount) {
          queryClient.setQueryData(UNREAD_COUNT_KEY, {
            count: Math.max(0, previousCount.count - 1),
          });
        }
      }
      return { previousPage, previousCount };
    },
    onError: (_error, _id, snapshot) => {
      if (snapshot?.previousPage) queryClient.setQueryData(LIST_KEY, snapshot.previousPage);
      if (snapshot?.previousCount) {
        queryClient.setQueryData(UNREAD_COUNT_KEY, snapshot.previousCount);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<{ updated: number }>('/org/notifications/read-all', { method: 'POST' }),
    onMutate: async (): Promise<OptimisticSnapshot> => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const previousPage = queryClient.getQueryData<NotificationPage>(LIST_KEY);
      const previousCount = queryClient.getQueryData<UnreadCount>(UNREAD_COUNT_KEY);
      if (previousPage) {
        queryClient.setQueryData(LIST_KEY, markLocallyRead(previousPage, () => true));
      }
      queryClient.setQueryData<UnreadCount>(UNREAD_COUNT_KEY, { count: 0 });
      return { previousPage, previousCount };
    },
    onError: (_error, _variables, snapshot) => {
      if (snapshot?.previousPage) queryClient.setQueryData(LIST_KEY, snapshot.previousPage);
      if (snapshot?.previousCount) {
        queryClient.setQueryData(UNREAD_COUNT_KEY, snapshot.previousCount);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}
