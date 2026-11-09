import { forwardRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import type { CSSProperties } from 'react';
import { Button } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from '@/hooks/useNotifications';
import type { NotificationItem } from '@/hooks/useNotifications';
import {
  BellOffIcon,
  NotificationTypeIcon,
  notificationTypeLabel,
  TrashIcon,
} from './NotificationIcons';

interface NotificationPanelProps {
  variant: 'sidebar' | 'mobile';
  onClose: () => void;
  /** Fixed position supplied by NotificationBell: the panel is portalled out of the sidebar. */
  style: CSSProperties;
  id?: string;
}

export const NotificationPanel = forwardRef<HTMLDivElement, NotificationPanelProps>(
  function NotificationPanel({ variant, onClose, style, id }, ref) {
    const navigate = useNavigate();
    const toast = useToast();
    const { data, isPending, isError, isFetching, refetch } = useNotifications(true);
    const { data: unreadData, refetch: refetchUnreadCount } = useUnreadNotificationCount();
    const markRead = useMarkNotificationRead();
    const markAllRead = useMarkAllNotificationsRead();
    const deleteNotification = useDeleteNotification();

    // Opening the panel is the natural refresh point for the badge.
    useEffect(() => {
      void refetchUnreadCount();
    }, [refetchUnreadCount]);

    const items = data?.items ?? [];
    const unreadCount = data?.unread_count ?? unreadData?.count ?? 0;

    const openNotification = (item: NotificationItem) => {
      // Optimistic: the row flips to read and the badge drops before navigation.
      if (!item.read_at) markRead.mutate(item.id);
      onClose();
      const target = item.link || (item.feedback_id ? `/feedback/${item.feedback_id}` : null);
      if (target) navigate(target);
    };

    const removeNotification = (item: NotificationItem) => {
      deleteNotification.mutate(item.id, {
        onError: () => toast.show('删除通知失败', 'error'),
      });
    };

    return (
      <div
        ref={ref}
        id={id}
        role="dialog"
        aria-label="通知"
        tabIndex={-1}
        className={clsx(
          'fixed z-[85] flex animate-scale-in flex-col overflow-hidden rounded-xl border border-surface-3 bg-surface-0 shadow-pop',
          'focus:outline-none dark:border-gray-700 dark:bg-gray-800',
        )}
        style={style}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-surface-2 px-3.5 py-2.5 dark:border-gray-700/60">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">通知</h2>
            {unreadCount > 0 && (
              <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-brand-700 dark:bg-brand-600/15 dark:text-brand-300">
                {unreadCount > 99 ? '99+' : `${unreadCount} 条未读`}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={unreadCount === 0 || markAllRead.isPending}
            className={clsx(
              'shrink-0 rounded-md px-2 py-1 text-[12px] font-medium transition-colors',
              'text-brand-600 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40',
              'dark:text-brand-300 dark:hover:bg-brand-600/15',
            )}
          >
            全部已读
          </button>
        </div>

        <div
          className={clsx(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain',
            variant === 'mobile' && 'pb-1',
          )}
        >
          {isPending ? (
            <PanelSkeleton />
          ) : isError ? (
            <PanelError onRetry={() => void refetch()} retrying={isFetching} />
          ) : items.length === 0 ? (
            <PanelEmpty />
          ) : (
            <ul role="list" className="divide-y divide-surface-2 dark:divide-gray-700/50">
              {items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  onOpen={openNotification}
                  onDelete={removeNotification}
                  deleting={
                    deleteNotification.isPending && deleteNotification.variables === item.id
                  }
                />
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            navigate('/notifications');
          }}
          className={clsx(
            'flex shrink-0 items-center justify-center gap-1 border-t border-surface-2 px-3.5 py-2 text-[12px] font-medium transition-colors',
            'text-gray-500 hover:bg-surface-1 hover:text-gray-700',
            'dark:border-gray-700/60 dark:text-gray-400 dark:hover:bg-gray-700/40 dark:hover:text-gray-200',
          )}
        >
          查看全部通知
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="m6 4 4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    );
  },
);

interface NotificationRowProps {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
  onDelete: (item: NotificationItem) => void;
  deleting: boolean;
}

function NotificationRow({ item, onOpen, onDelete, deleting }: NotificationRowProps) {
  const unread = !item.read_at;
  return (
    <li
      className={clsx(
        'group flex items-stretch transition-colors',
        unread
          ? 'bg-brand-50/60 hover:bg-brand-50 dark:bg-brand-600/10 dark:hover:bg-brand-600/20'
          : 'hover:bg-surface-1 dark:hover:bg-gray-700/40',
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex min-w-0 flex-1 items-start gap-2.5 py-2.5 pl-3.5 pr-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/45"
      >
        <NotificationTypeIcon type={item.type} className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span className="sr-only">
              {notificationTypeLabel(item.type)}
              {unread ? '，未读' : ''}：
            </span>
            <span
              className={clsx(
                'min-w-0 flex-1 truncate text-[13px] leading-snug',
                unread
                  ? 'font-semibold text-gray-900 dark:text-gray-100'
                  : 'font-medium text-gray-700 dark:text-gray-300',
              )}
            >
              {item.title}
            </span>
            {unread && (
              <span
                aria-hidden="true"
                className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600 dark:bg-brand-400"
              />
            )}
          </span>
          {item.body && (
            <span className="mt-0.5 line-clamp-2 break-words text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
              {item.body}
            </span>
          )}
          <span className="mt-1 block text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
            {formatRelativeTime(item.created_at)}
          </span>
        </span>
      </button>
      <span className="flex shrink-0 items-start pr-1.5 pt-2">
        <button
          type="button"
          aria-label="删除通知"
          title="删除通知"
          disabled={deleting}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(item);
          }}
          className={clsx(
            'flex h-9 w-9 items-center justify-center rounded-lg transition-all md:h-7 md:w-7',
            'text-gray-400 hover:bg-rose-50 hover:text-rose-600 dark:text-gray-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400',
            'opacity-0 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 disabled:opacity-40',
          )}
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </span>
    </li>
  );
}

function PanelSkeleton() {
  return (
    <div aria-busy="true" className="space-y-1 p-2">
      <span className="sr-only">正在加载通知</span>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-start gap-2.5 px-1.5 py-2.5">
          <div className="skeleton h-7 w-7 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3 w-3/4 rounded" />
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-2.5 w-12 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PanelEmpty() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-surface-3 bg-surface-1 text-gray-400 dark:border-gray-700/70 dark:bg-gray-700/40 dark:text-gray-500">
        <BellOffIcon />
      </span>
      <p className="mt-3 text-[13px] font-semibold text-gray-700 dark:text-gray-200">暂无通知</p>
      <p className="mt-1 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
        有新的反馈、指派、状态变更或评论时会出现在这里。
      </p>
    </div>
  );
}

function PanelError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 6v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="10" cy="13.6" r="1" fill="currentColor" />
        </svg>
      </span>
      <p className="mt-3 text-[13px] font-semibold text-gray-700 dark:text-gray-200">通知加载失败</p>
      <p className="mt-1 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
        服务可能尚未就绪，请稍后重试。
      </p>
      <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry} disabled={retrying}>
        {retrying ? '重试中…' : '重试'}
      </Button>
    </div>
  );
}
