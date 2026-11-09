import { clsx } from 'clsx';
import { StatusBadge } from '@/components/StatusBadge';
import { CategoryBadge, PriorityBadge, SourceBadge } from '@/components/badges';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import type { FeedbackItem } from '@/types';

interface FeedbackCardsProps {
  items: FeedbackItem[];
  selected: Set<string>;
  view: 'active' | 'trash';
  restoring: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onRestore: (id: string) => void;
}

export function FeedbackCards({
  items,
  selected,
  view,
  restoring,
  onToggleSelect,
  onOpen,
  onRestore,
}: FeedbackCardsProps) {
  return (
    <div className="space-y-2.5 lg:hidden">
      {items.map((item) => (
        <div
          key={item.id}
          onClick={() => onOpen(item.id)}
          className={clsx(
            'cursor-pointer rounded-xl border bg-surface-0 p-4 shadow-card transition-all duration-150 active:scale-[0.995]',
            selected.has(item.id)
              ? 'border-brand-300 ring-1 ring-brand-200 dark:border-brand-500/50 dark:ring-brand-500/20'
              : 'border-surface-3 dark:border-gray-700/80',
            'dark:bg-gray-800',
            view === 'trash' && 'opacity-70',
          )}
        >
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={() => onToggleSelect(item.id)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`选择 ${item.title}`}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-brand-600 accent-brand-600 focus:ring-2 focus:ring-brand-500/30 dark:border-gray-600 dark:bg-gray-700"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-medium leading-snug text-gray-900 dark:text-gray-100">
                  {item.title}
                </p>
                <StatusBadge status={item.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <CategoryBadge category={item.category} />
                <PriorityBadge priority={item.priority} />
                <SourceBadge source={item.source} />
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  {formatRelativeTime(item.created_at)}
                </span>
              </div>
              {item.tags?.length ? (
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {item.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-700/70 dark:text-gray-300"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: tag.color ?? '#6b7280' }}
                      />
                      {tag.name}
                    </span>
                  ))}
                </div>
              ) : null}
              {view === 'trash' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestore(item.id);
                  }}
                  disabled={restoring}
                  className="mt-2 rounded-md border border-surface-3 px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-gray-600 dark:text-gray-400"
                >
                  恢复
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
