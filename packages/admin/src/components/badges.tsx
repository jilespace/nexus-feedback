import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { categoryColor, categoryLabel, priorityColor, priorityLabel, sourceLabel } from '@/utils/labels';
import type { FeedbackPriority, FeedbackSource } from '@/types';

export function CategoryBadge({ category }: { category: string }) {
  const { i18n } = useTranslation();
  const color = categoryColor(category);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate">{categoryLabel(category, i18n.language)}</span>
    </span>
  );
}

const PRIORITY_WEIGHTS: Record<FeedbackPriority, string> = {
  low: 'text-gray-500 dark:text-gray-400',
  medium: 'text-gray-600 dark:text-gray-300',
  high: 'text-orange-600 dark:text-orange-400',
  critical: 'text-rose-600 dark:text-rose-400',
};

export function PriorityBadge({ priority }: { priority: FeedbackPriority }) {
  const { i18n } = useTranslation();
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium',
        PRIORITY_WEIGHTS[priority] ?? 'text-gray-500',
      )}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: priorityColor(priority) }}
      />
      {priorityLabel(priority, i18n.language)}
    </span>
  );
}

export function SourceBadge({ source }: { source?: FeedbackSource | string }) {
  const { i18n } = useTranslation();
  return (
    <span className="inline-flex items-center rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-700/60 dark:text-gray-400">
      {sourceLabel(source, i18n.language)}
    </span>
  );
}
