import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { StatusBadge } from '@/components/StatusBadge';
import { CategoryBadge, PriorityBadge, SourceBadge } from '@/components/badges';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import type { FeedbackItem } from '@/types';

interface FeedbackTableProps {
  items: FeedbackItem[];
  selected: Set<string>;
  view: 'active' | 'trash';
  restoring: boolean;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (id: string) => void;
  onRestore: (id: string) => void;
}

export function FeedbackTable({
  items,
  selected,
  view,
  restoring,
  onToggleSelect,
  onToggleAll,
  onOpen,
  onRestore,
}: FeedbackTableProps) {
  const { t } = useTranslation();
  const { t: tf } = useTranslation('feedback');
  const allSelected = items.length > 0 && selected.size === items.length;

  return (
    <div className="hidden overflow-hidden rounded-xl border border-surface-3 bg-surface-0 shadow-card dark:border-gray-700/80 dark:bg-gray-800 lg:block">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-surface-3 bg-surface-1/80 dark:border-gray-700/80 dark:bg-gray-800/60">
            <th className="w-12 py-2.5 pl-4 pr-0">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                aria-label={tf('table.selectAll')}
                className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-brand-600 accent-brand-600 focus:ring-2 focus:ring-brand-500/30 dark:border-gray-600 dark:bg-gray-700"
              />
            </th>
            {[
              t('feedback.col_title'),
              t('feedback.col_source'),
              t('feedback.col_category'),
              tf('table.assignee'),
              t('feedback.col_tags'),
              t('feedback.col_priority'),
              t('feedback.col_status'),
              t('feedback.col_time'),
            ].map((label) => (
              <th
                key={label}
                className="whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-2 dark:divide-gray-700/70">
          {items.map((item) => (
            <tr
              key={item.id}
              data-shortcut-item
              onClick={() => onOpen(item.id)}
              className={clsx(
                'group cursor-pointer transition-colors',
                selected.has(item.id)
                  ? 'bg-brand-50/50 dark:bg-brand-600/10'
                  : 'hover:bg-surface-1/70 dark:hover:bg-gray-700/30',
                view === 'trash' && 'opacity-70',
              )}
            >
              <td className="py-3 pl-4 pr-0" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => onToggleSelect(item.id)}
                  aria-label={tf('row.selectRow', { title: item.title })}
                  className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-brand-600 accent-brand-600 focus:ring-2 focus:ring-brand-500/30 dark:border-gray-600 dark:bg-gray-700"
                />
              </td>
              <td className="max-w-[380px] px-3 py-3">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-gray-900 group-hover:text-brand-700 dark:text-gray-100 dark:group-hover:text-brand-300">
                    {item.title}
                  </span>
                  {item.reply_count > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-700/70 dark:text-gray-400">
                      {item.reply_count}
                    </span>
                  )}
                </div>
                {view === 'trash' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestore(item.id);
                    }}
                    disabled={restoring}
                    className="mt-1 rounded-md border border-surface-3 px-1.5 py-0.5 text-[11px] font-medium text-gray-500 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-gray-600 dark:text-gray-400"
                  >
                    {tf('row.restore')}
                  </button>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                <SourceBadge source={item.source} />
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                <CategoryBadge category={item.category} />
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                <AssigneeCell assignee={item.assignee} />
              </td>
              <td className="px-3 py-3">
                <TagChips tags={item.tags} />
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                <PriorityBadge priority={item.priority} />
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                <StatusBadge status={item.status} />
              </td>
              <td
                className="whitespace-nowrap px-3 py-3 text-xs text-gray-400 dark:text-gray-500"
                title={new Date(item.created_at).toLocaleString()}
              >
                {formatRelativeTime(item.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssigneeCell({
  assignee,
}: {
  assignee?: { id: string; display_name: string } | null;
}) {
  if (!assignee) {
    return <span className="text-gray-300 dark:text-gray-600">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[10px] font-semibold text-brand-700 ring-1 ring-brand-100 dark:bg-brand-600/20 dark:text-brand-300 dark:ring-brand-500/20">
        {assignee.display_name.charAt(0)}
      </span>
      <span className="max-w-[90px] truncate text-xs text-gray-600 dark:text-gray-300">
        {assignee.display_name}
      </span>
    </span>
  );
}

function TagChips({ tags }: { tags?: { id: string; name: string; color: string | null }[] }) {
  if (!tags?.length) {
    return <span className="text-gray-300 dark:text-gray-600">—</span>;
  }
  const shown = tags.slice(0, 2);
  const rest = tags.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-700/70 dark:text-gray-300"
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: tag.color ?? '#6b7280' }}
          />
          <span className="max-w-[80px] truncate">{tag.name}</span>
        </span>
      ))}
      {rest > 0 && <span className="text-[11px] text-gray-400 dark:text-gray-500">+{rest}</span>}
    </div>
  );
}
