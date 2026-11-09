import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';
import { Card } from '@/components/ui';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import { STATUS_META, statusLabel } from '@/utils/labels';
import { useTranslation } from 'react-i18next';
import type { FeedbackStatus } from '@/types';

type StatusHistoryItem = {
  id: string;
  old_status: string;
  new_status: string;
  created_at: string;
  member?: { id: string; display_name: string } | null;
};

export function StatusHistory({ feedbackId }: { feedbackId: string }) {
  const { i18n } = useTranslation();
  const { data: history } = useQuery({
    queryKey: ['status-history', feedbackId],
    queryFn: () => apiRequest<StatusHistoryItem[]>(`/admin/feedback/${feedbackId}/history`),
  });

  if (!history || history.length === 0) return null;

  const dot = (status: string) =>
    STATUS_META[status as FeedbackStatus]?.dot ?? '#94a3b8';

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">状态变更记录</h2>
      <ol className="relative space-y-3.5 pl-4">
        <span className="absolute bottom-2 left-[5px] top-2 w-px bg-surface-3 dark:bg-gray-700" />
        {history.map((item) => (
          <li key={item.id} className="relative">
            <span
              className="absolute -left-4 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-surface-0 dark:ring-gray-800"
              style={{ backgroundColor: dot(item.new_status) }}
            />
            <div className="flex flex-wrap items-center gap-x-2 text-[13px]">
              <span className="text-gray-400 line-through decoration-gray-300 dark:text-gray-500">
                {statusLabel(item.old_status as FeedbackStatus, i18n.language)}
              </span>
              <span className="text-gray-300 dark:text-gray-600">→</span>
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {statusLabel(item.new_status as FeedbackStatus, i18n.language)}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
              {item.member?.display_name || '系统'} · {formatRelativeTime(item.created_at)}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
