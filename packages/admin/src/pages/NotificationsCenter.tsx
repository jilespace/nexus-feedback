import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { apiRequest } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { Badge, Button, Card, EmptyState, Skeleton } from '@/components/ui';
import { Pagination } from '@/components/feedback/Pagination';
import { useToast } from '@/components/Toast';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import type { NotificationItem, NotificationPage, NotificationType } from '@/hooks/useNotifications';

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

const PAGE_SIZE = 20;

export function NotificationsCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications-page', filter, page],
    queryFn: () =>
      apiRequest<NotificationPage>(
        `/org/notifications?page=${page}&page_size=${PAGE_SIZE}${filter === 'unread' ? '&unread=true' : ''}`,
      ),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
  };

  const readMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ updated: boolean }>(`/org/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: invalidate,
    onError: () => toast.show('标记已读失败', 'error'),
  });

  const readAllMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ updated: number }>('/org/notifications/read-all', { method: 'POST' }),
    onSuccess: (result) => {
      toast.show(result.updated > 0 ? `已标记 ${result.updated} 条为已读` : '没有未读通知');
      invalidate();
    },
    onError: () => toast.show('操作失败', 'error'),
  });

  const open = (item: NotificationItem) => {
    if (!item.read_at) readMutation.mutate(item.id);
    const target = item.link || (item.feedback_id ? `/feedback/${item.feedback_id}` : null);
    if (target) navigate(target);
  };

  const items = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;
  const unreadCount = data?.unread_count ?? 0;

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="通知"
        description="反馈创建、指派、状态变更与评论都会在这里提醒你。"
        actions={
          <Button
            variant="secondary"
            onClick={() => readAllMutation.mutate()}
            disabled={readAllMutation.isPending || unreadCount === 0}
          >
            {readAllMutation.isPending ? '处理中...' : '全部标为已读'}
          </Button>
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
        <span className="text-xs text-gray-400 dark:text-gray-500">
          共 {data?.total ?? 0} 条
        </span>
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
                  <li key={item.id}>
                    <button
                      onClick={() => open(item)}
                      className={clsx(
                        'flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors',
                        unread
                          ? 'bg-brand-50/40 hover:bg-brand-50/70 dark:bg-brand-600/10 dark:hover:bg-brand-600/15'
                          : 'hover:bg-surface-1/60 dark:hover:bg-gray-700/20',
                      )}
                    >
                      <span
                        className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${meta.dot}18`, color: meta.dot }}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.dot }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-medium text-gray-800 dark:text-gray-100">
                            {item.title}
                          </span>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
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
    </div>
  );
}
