import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import type { NotificationType } from '@/hooks/useNotifications';

interface IconProps {
  className?: string;
}

export function BellIcon({ className }: IconProps) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={clsx('shrink-0', className)}
    >
      <path
        d="M10 2.8a5.1 5.1 0 0 0-5.1 5.1v2.8L3.6 13.2h12.8l-1.3-2.5V7.9A5.1 5.1 0 0 0 10 2.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8.1 15.4a2 2 0 0 0 3.8 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BellOffIcon({ className }: IconProps) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={clsx('shrink-0', className)}
    >
      <path
        d="M10 2.8A5.1 5.1 0 0 0 4.9 7.9v2.8L3.6 13.2h9.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12.9 10.8V7.9a5.1 5.1 0 0 0-1.3-3.4M8.1 15.4a2 2 0 0 0 3.8 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="m3 3 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** One distinct colour + glyph per notification type so type is never signalled by colour alone. */
const TYPE_META: Record<NotificationType, { label: string; wrapper: string; icon: ReactNode }> = {
  'feedback.created': {
    label: '新反馈',
    wrapper:
      'bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8 3.4v9.2M3.4 8h9.2"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  'feedback.assigned': {
    label: '已指派',
    wrapper:
      'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="6.4" cy="5.4" r="2.2" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M2.8 12.6c.5-1.9 1.9-3 3.6-3 .9 0 1.7.3 2.3.9"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="m9.8 11.3 1.4 1.4 3-3.1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  'feedback.status_changed': {
    label: '状态变更',
    wrapper: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M2.9 8a5.1 5.1 0 0 1 8.4-3.9M13.1 8a5.1 5.1 0 0 1-8.4 3.9"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M11.8 1.9v2.6H9.2M4.2 14.1v-2.6h2.6"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  'feedback.comment': {
    label: '新评论',
    wrapper: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M2.8 4.4c0-.8.6-1.5 1.5-1.5h7.4c.8 0 1.5.6 1.5 1.5v4.9c0 .8-.7 1.5-1.5 1.5H7.1l-2.9 2.2v-2.2h-.2c-.7 0-1.2-.7-1.2-1.5V4.4Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
};

const FALLBACK_META = {
  label: '通知',
  wrapper: 'bg-surface-2 text-gray-500 dark:bg-gray-700/60 dark:text-gray-400',
  icon: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 7.4v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="5.2" r="0.8" fill="currentColor" />
    </svg>
  ),
};

export function notificationTypeLabel(type: NotificationType): string {
  return TYPE_META[type]?.label ?? FALLBACK_META.label;
}

interface NotificationTypeIconProps {
  type: NotificationType;
  className?: string;
}

export function NotificationTypeIcon({ type, className }: NotificationTypeIconProps) {
  const meta = TYPE_META[type] ?? FALLBACK_META;
  return (
    <span
      className={clsx(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
        meta.wrapper,
        className,
      )}
    >
      {meta.icon}
    </span>
  );
}
