import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
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

export type NotificationFilter = 'all' | 'unread';

type UnreadCount = { count: number };

/** Both the bell panel and the full notifications page share this root key, so one
 *  invalidation refreshes the panel list, every page-list cache and the badge. */
const NOTIFICATIONS_KEY = ['notifications'] as const;
const LIST_KEY = [...NOTIFICATIONS_KEY, 'list'] as const;
const UNREAD_COUNT_KEY = [...NOTIFICATIONS_KEY, 'unread-count'] as const;
const PAGE_KEY = [...NOTIFICATIONS_KEY, 'page'] as const;

export const NOTIFICATIONS_PAGE_SIZE = 20;

export function notificationsPageKey(filter: NotificationFilter, page: number) {
  return [...PAGE_KEY, filter, page] as const;
}

export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () =>
      apiRequest<NotificationPage>(
        `/org/notifications?page=1&page_size=${NOTIFICATIONS_PAGE_SIZE}`,
      ),
    enabled,
  });
}

export function useNotificationPage(filter: NotificationFilter, page: number) {
  return useQuery({
    queryKey: notificationsPageKey(filter, page),
    queryFn: () =>
      apiRequest<NotificationPage>(
        `/org/notifications?page=${page}&page_size=${NOTIFICATIONS_PAGE_SIZE}${
          filter === 'unread' ? '&unread=true' : ''
        }`,
      ),
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

type NotificationCaches = {
  panel: NotificationPage | undefined;
  unread: UnreadCount | undefined;
  pages: Array<[QueryKey, NotificationPage | undefined]>;
};

function snapshotCaches(queryClient: QueryClient): NotificationCaches {
  return {
    panel: queryClient.getQueryData<NotificationPage>(LIST_KEY),
    unread: queryClient.getQueryData<UnreadCount>(UNREAD_COUNT_KEY),
    pages: queryClient.getQueriesData<NotificationPage>({ queryKey: PAGE_KEY }),
  };
}

function restoreCaches(queryClient: QueryClient, snapshot: NotificationCaches) {
  queryClient.setQueryData(LIST_KEY, snapshot.panel);
  queryClient.setQueryData(UNREAD_COUNT_KEY, snapshot.unread);
  for (const [key, page] of snapshot.pages) {
    queryClient.setQueryData(key, page);
  }
}

function findCachedNotification(
  queryClient: QueryClient,
  id: string,
): NotificationItem | undefined {
  const panel = queryClient.getQueryData<NotificationPage>(LIST_KEY);
  const fromPanel = panel?.items.find((item) => item.id === id);
  if (fromPanel) return fromPanel;
  for (const [, page] of queryClient.getQueriesData<NotificationPage>({ queryKey: PAGE_KEY })) {
    const found = page?.items.find((item) => item.id === id);
    if (found) return found;
  }
  return undefined;
}

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

function withoutNotification(page: NotificationPage, id: string): NotificationPage {
  const target = page.items.find((item) => item.id === id);
  if (!target) return page;
  return {
    ...page,
    items: page.items.filter((item) => item.id !== id),
    total: Math.max(0, page.total - 1),
    unread_count: target.read_at ? page.unread_count : Math.max(0, page.unread_count - 1),
  };
}

function emptiedPage(page: NotificationPage): NotificationPage {
  if (page.items.length === 0 && page.total === 0 && page.unread_count === 0) return page;
  return { ...page, items: [], total: 0, unread_count: 0 };
}

function applyToEveryCache(
  queryClient: QueryClient,
  update: (page: NotificationPage) => NotificationPage,
) {
  const panel = queryClient.getQueryData<NotificationPage>(LIST_KEY);
  if (panel) queryClient.setQueryData(LIST_KEY, update(panel));
  queryClient.setQueriesData<NotificationPage>({ queryKey: PAGE_KEY }, (page) =>
    page ? update(page) : page,
  );
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ updated: boolean }>(`/org/notifications/${id}/read`, { method: 'POST' }),
    onMutate: async (id): Promise<NotificationCaches> => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const snapshot = snapshotCaches(queryClient);
      const target = findCachedNotification(queryClient, id);
      applyToEveryCache(queryClient, (page) =>
        markLocallyRead(page, (item) => item.id === id),
      );
      if (target && !target.read_at) {
        const unread = queryClient.getQueryData<UnreadCount>(UNREAD_COUNT_KEY);
        if (unread) {
          queryClient.setQueryData(UNREAD_COUNT_KEY, { count: Math.max(0, unread.count - 1) });
        }
      }
      return snapshot;
    },
    onError: (_error, _id, snapshot) => {
      if (snapshot) restoreCaches(queryClient, snapshot);
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
    onMutate: async (): Promise<NotificationCaches> => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const snapshot = snapshotCaches(queryClient);
      applyToEveryCache(queryClient, (page) => markLocallyRead(page, () => true));
      queryClient.setQueryData<UnreadCount>(UNREAD_COUNT_KEY, { count: 0 });
      return snapshot;
    },
    onError: (_error, _variables, snapshot) => {
      if (snapshot) restoreCaches(queryClient, snapshot);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ deleted: boolean }>(`/org/notifications/${id}`, { method: 'DELETE' }),
    onMutate: async (id): Promise<NotificationCaches> => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const snapshot = snapshotCaches(queryClient);
      const target = findCachedNotification(queryClient, id);
      const wasUnread = Boolean(target && !target.read_at);
      applyToEveryCache(queryClient, (page) => withoutNotification(page, id));
      if (wasUnread) {
        const unread = queryClient.getQueryData<UnreadCount>(UNREAD_COUNT_KEY);
        if (unread) {
          queryClient.setQueryData(UNREAD_COUNT_KEY, {
            count: Math.max(0, unread.count - 1),
          });
        }
      }
      return snapshot;
    },
    onError: (_error, _id, snapshot) => {
      if (snapshot) restoreCaches(queryClient, snapshot);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useClearNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<{ deleted: number }>('/org/notifications', { method: 'DELETE' }),
    onMutate: async (): Promise<NotificationCaches> => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const snapshot = snapshotCaches(queryClient);
      applyToEveryCache(queryClient, emptiedPage);
      queryClient.setQueryData<UnreadCount>(UNREAD_COUNT_KEY, { count: 0 });
      return snapshot;
    },
    onError: (_error, _variables, snapshot) => {
      if (snapshot) restoreCaches(queryClient, snapshot);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}
