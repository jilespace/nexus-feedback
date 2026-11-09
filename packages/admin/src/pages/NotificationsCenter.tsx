import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { apiRequest } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { Badge, Button, Card, CardHeader, EmptyState, Skeleton, Switch } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { Pagination } from '@/components/feedback/Pagination';
import { useToast } from '@/components/Toast';
import { TrashIcon } from '@/components/notifications/NotificationIcons';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import {
  useClearNotifications,
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationPage,
} from '@/hooks/useNotifications';
import type { NotificationItem, NotificationType } from '@/hooks/useNotifications';

type Filter = 'all' | 'unread';

const TYPE_META: Record<
  NotificationType,
  { label: string; tone: 'brand' | 'amber' | 'blue' | 'green'; dot: string }
> = {
  'feedback.created': { label: '新反馈', tone: 'brand', dot: '#3D5AFE' },
  'feedback.assigned': { label: '指派', tone: 'amber', dot: '#F59E0B' },
  'feedback.status_changed': { label: '状态', tone: 'blue', dot: '#0EA5E9' },
  'feedback.comment': { label: '评论', tone: 'green', dot: '#10B981' },
};

type NotificationSettings = Record<NotificationType, boolean>;

const SETTING_ROWS: Array<{ key: NotificationType; label: string; description: string }> = [
  {
    key: 'feedback.created',
    label: '新反馈',
    description: '有新的用户反馈提交时通知我',
  },
  {
    key: 'feedback.assigned',
    label: '指派给我',
    description: '反馈负责人变更为我时通知我',
  },
  {
    key: 'feedback.status_changed',
    label: '状态变更',
    description: '我负责的反馈状态发生变化时通知我',
  },
  {
    key: 'feedback.comment',
    label: '新评论',
    description: '反馈收到新评论时通知我',
  },
];

export function NotificationsCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [confirmClear, setConfirmClear] = useState(false);

  const { data, isLoading, isError, refetch } = useNotificationPage(filter, page);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();
  const clearNotifications = useClearNotifications();

  const open = (item: NotificationItem) => {
    if (!item.read_at) {
      markRead.mutate(item.id, {
        onError: () => toast.show('标记已读失败', 'error'),
      });
    }
    const target = item.link || (item.feedback_id ? `/feedback/${item.feedback_id}` : null);
    if (target) navigate(target);
  };

  const remove = (item: NotificationItem) => {
    deleteNotification.mutate(item.id, {
      onError: () => toast.show('删除通知失败', 'error'),
    });
  };

  const readAll = () => {
    markAllRead.mutate(undefined, {
      onSuccess: (result) =>
        toast.show(result.updated > 0 ? `已标记 ${result.updated} 条为已读` : '没有未读通知'),
      onError: () => toast.show('操作失败', 'error'),
    });
  };

  const confirmClearAll = () => {
    clearNotifications.mutate(undefined, {
      onSuccess: (result) => {
        toast.show(`已清空 ${result.deleted} 条通知`);
        setConfirmClear(false);
        setPage(1);
      },
      onError: () => toast.show('清空通知失败', 'error'),
    });
  };

  const { data: settings } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: () => apiRequest<NotificationSettings>('/org/notifications/settings'),
  });

  const settingsMutation = useMutation({
    mutationFn: (patch: Partial<NotificationSettings>) =>
      apiRequest<NotificationSettings>('/org/notifications/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: patch }),
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(['notification-settings'], next);
    },
    onError: () => toast.show('通知偏好保存失败', 'error'),
  });

  const toggleSetting = (key: NotificationType, value: boolean) => {
    if (!settings) return;
    queryClient.setQueryData(['notification-settings'], { ...settings, [key]: value });
    settingsMutation.mutate({ [key]: value });
  };

  const items = data?.items ?? [];
  const totalCount = data?.total ?? 0;
  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;
  const unreadCount = data?.unread_count ?? 0;

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="通知"
        description="反馈创建、指派、状态变更与评论都会在这里提醒你。"
        actions={
          <>
            <Button variant="secondary" onClick={readAll} disabled={markAllRead.isPending || unreadCount === 0}>
              {markAllRead.isPending ? '处理中...' : '全部标为已读'}
            </Button>
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={totalCount === 0 || clearNotifications.isPending}
              className={clsx(
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors',
                'text-rose-600 hover:bg-rose-50 active:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40',
                'dark:text-rose-300 dark:hover:bg-rose-500/10 dark:active:bg-rose-500/15',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 dark:focus-visible:ring-offset-gray-800',
              )}
            >
              <TrashIcon className="h-3.5 w-3.5" />
              清空全部
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-surface-3 bg-surface-1/70 p-0.5 dark:border-gray-700 dark:bg-gray-900/40">
          {(
            [
              ['all', '全部'],
              ['unread', `未读${unreadCount > 0 ? ` (${unreadCount})` : ''}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setFilter(key);
                setPage(1);
              }}
              className={clsx(
                'h-7 rounded-md px-3 text-xs font-medium transition-all',
                filter === key
                  ? 'bg-surface-0 text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                  : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">共 {totalCount} 条</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <EmptyState
            title="通知加载失败"
            description="请检查网络后重试"
            action={{ label: '重新加载', onClick: () => void refetch() }}
          />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title={filter === 'unread' ? '没有未读通知' : '暂无通知'}
            description="有新的反馈动态时会出现在这里"
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-surface-2 dark:divide-gray-700/60">
              {items.map((item) => {
                const meta = TYPE_META[item.type] ?? TYPE_META['feedback.created'];
                const unread = !item.read_at;
                return (
                  <li
                    key={item.id}
                    className={clsx(
                      'group flex items-stretch transition-colors',
                      unread
                        ? 'bg-brand-50/40 hover:bg-brand-50/70 dark:bg-brand-600/10 dark:hover:bg-brand-600/15'
                        : 'hover:bg-surface-1/60 dark:hover:bg-gray-700/20',
                    )}
                  >
                    <button
                      onClick={() => open(item)}
                      className="flex min-w-0 flex-1 items-start gap-3 py-3.5 pl-5 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/45"
                    >
                      <span
                        className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${meta.dot}18`, color: meta.dot }}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.dot }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-800 dark:text-gray-100">
                            {item.title}
                          </span>
                          <span className="shrink-0">
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                          </span>
                          {unread && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                          )}
                        </span>
                        {item.body && (
                          <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
                            {item.body}
                          </span>
                        )}
                        <span className="mt-1 block text-[11px] text-gray-400 dark:text-gray-500">
                          {formatRelativeTime(item.created_at)}
                        </span>
                      </span>
                    </button>
                    <span className="flex shrink-0 items-start pr-2.5 pt-2">
                      <button
                        type="button"
                        aria-label="删除通知"
                        title="删除通知"
                        disabled={
                          deleteNotification.isPending &&
                          deleteNotification.variables === item.id
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          remove(item);
                        }}
                        className={clsx(
                          'flex h-9 w-9 items-center justify-center rounded-lg transition-all',
                          'text-gray-400 hover:bg-rose-50 hover:text-rose-600 dark:text-gray-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400',
                          'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 max-md:opacity-100',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 disabled:cursor-not-allowed',
                        )}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={(next) => {
              setPage(next);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}

      <Card className="p-5">
        <CardHeader
          title="通知偏好"
          description="选择你希望收到的站内通知类型；关闭后仍可在上方列表中查看历史通知。"
          className="mb-2"
        />
        {!settings ? (
          <div className="space-y-2 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-surface-2 dark:divide-gray-700/60">
            {SETTING_ROWS.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200">
                    {row.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                    {row.description}
                  </p>
                </div>
                <Switch
                  checked={settings[row.key]}
                  onChange={(value) => toggleSetting(row.key, value)}
                  label={`${row.label}通知`}
                  showState
                  stateLabels={['已开启', '已关闭']}
                  disabled={settingsMutation.isPending}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {confirmClear && (
        <Modal
          title="清空全部通知"
          description="此操作不可恢复"
          size="sm"
          onClose={() => setConfirmClear(false)}
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmClear(false)}
                disabled={clearNotifications.isPending}
              >
                取消
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmClearAll}
                disabled={clearNotifications.isPending}
              >
                {clearNotifications.isPending ? '清空中...' : '确认清空'}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            将删除全部 {totalCount} 条通知（包含已读与未读），删除后不可恢复。
          </p>
        </Modal>
      )}
    </div>
  );
}
