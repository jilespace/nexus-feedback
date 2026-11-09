import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

interface FeedbackBulkBarProps {
  count: number;
  batchPending: boolean;
  assignPending: boolean;
  members: Array<{ id: string; display_name: string }>;
  onClose: () => void;
  onBatchClose: () => void;
  onAssign: (assigneeId: string | null) => void;
}

export function FeedbackBulkBar({
  count,
  batchPending,
  assignPending,
  members,
  onClose,
  onBatchClose,
  onAssign,
}: FeedbackBulkBarProps) {
  const { t } = useTranslation();
  return (
    <div className="flex animate-fade-up flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/80 px-3 py-2 dark:border-brand-500/30 dark:bg-brand-600/10">
      <span className="mr-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
        {t('feedback.selected_count', { count })}
      </span>
      <button
        onClick={onBatchClose}
        disabled={batchPending}
        className={clsx(
          'h-7 rounded-md bg-brand-600 px-2.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
        )}
      >
        {batchPending ? t('common.loading') : t('feedback.batch_close')}
      </button>
      <select
        value=""
        onChange={(e) => {
          if (!e.target.value) return;
          onAssign(e.target.value === '__unassigned__' ? null : e.target.value);
          e.target.value = '';
        }}
        disabled={assignPending}
        className="h-7 rounded-md border border-brand-200 bg-surface-0 px-2 text-xs font-medium text-brand-700 focus:outline-none dark:border-brand-500/40 dark:bg-gray-800 dark:text-brand-300"
      >
        <option value="" disabled>
          {assignPending ? '分配中...' : '分配给'}
        </option>
        <option value="__unassigned__">未分配</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.display_name}
          </option>
        ))}
      </select>
      <button
        onClick={onClose}
        className="ml-auto text-xs font-medium text-brand-600 transition-colors hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-200"
      >
        {t('feedback.cancel_select')}
      </button>
    </div>
  );
}
