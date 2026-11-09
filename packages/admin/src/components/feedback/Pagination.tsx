import { useTranslation } from 'react-i18next';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

function pageNumbers(page: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: Array<number | '…'> = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push('…');
    result.push(p);
    prev = p;
  }
  return result;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  const { t } = useTranslation();
  const { t: tf } = useTranslation('feedback');
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-1 pt-1" aria-label={tf('pagination.label')}>
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="h-8 rounded-lg border border-surface-3 bg-surface-0 px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-surface-1 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        {t('feedback.prev_page')}
      </button>
      {pageNumbers(page, totalPages).map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-1 text-xs text-gray-400 dark:text-gray-500">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={
              p === page
                ? 'h-8 min-w-8 rounded-lg bg-brand-600 px-2 text-xs font-semibold text-white shadow-sm'
                : 'h-8 min-w-8 rounded-lg border border-surface-3 bg-surface-0 px-2 text-xs font-medium text-gray-600 transition-colors hover:bg-surface-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }
          >
            {p}
          </button>
        ),
      )}
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="h-8 rounded-lg border border-surface-3 bg-surface-0 px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-surface-1 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        {t('feedback.next_page')}
      </button>
    </nav>
  );
}
