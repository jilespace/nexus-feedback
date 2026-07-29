import { clsx } from 'clsx';
import type { FeedbackStatus } from '@/types';

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; className: string; dot: string }> = {
  open: { label: '待处理', className: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  in_progress: { label: '进行中', className: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' },
  resolved: { label: '已解决', className: 'bg-green-50 text-green-700 ring-green-200', dot: 'bg-green-500' },
  closed: { label: '已关闭', className: 'bg-gray-100 text-gray-500 ring-gray-200', dot: 'bg-gray-400' },
};

export function StatusBadge({ status }: { status: FeedbackStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        config.className,
      )}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
}
