import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { apiRequest } from '@/api/client';
import { Button } from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';
import { SearchIcon } from '@/components/icons';
import type { FeedbackItem, PaginatedResponse } from '@/types';

interface MergeDialogProps {
  feedbackId: string;
  onClose: () => void;
  onMerged: (targetId: string) => void;
}

export function MergeDialog({ feedbackId, onClose, onMerged }: MergeDialogProps) {
  const { t } = useTranslation('detail');
  const toast = useToast();
  const [search, setSearch] = useState('');

  const { data: results, isFetching } = useQuery({
    queryKey: ['feedback-search', search],
    queryFn: () =>
      apiRequest<PaginatedResponse<FeedbackItem>>(
        `/admin/feedback?keyword=${encodeURIComponent(search)}&page_size=6`,
      ),
    enabled: search.trim().length > 1,
  });

  const mergeMutation = useMutation({
    mutationFn: (targetId: string) =>
      apiRequest(`/admin/feedback/${feedbackId}/merge`, {
        method: 'POST',
        body: JSON.stringify({ target_id: targetId }),
      }),
    onSuccess: (_data, targetId) => {
      toast.show(t('merge.success'));
      onMerged(targetId);
    },
    onError: (err) =>
      toast.show(err instanceof Error ? err.message : t('merge.failed'), 'error'),
  });

  const items = (results?.items ?? []).filter((item) => item.id !== feedbackId);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-gray-950/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-dialog-title"
        className="relative z-10 w-full animate-fade-up rounded-t-2xl border border-surface-3 bg-surface-0 p-5 shadow-pop dark:border-gray-700 dark:bg-gray-800 sm:max-w-lg sm:rounded-2xl"
      >
        <h3 id="merge-dialog-title" className="text-base font-semibold text-gray-900 dark:text-gray-50">
          {t('merge.title')}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          {t('merge.description')}
        </p>

        <div className="relative mt-4">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('merge.searchPlaceholder')}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
            className="h-10 w-full rounded-lg border border-surface-3 bg-surface-1/60 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100"
          />
        </div>

        <div className="mt-2 max-h-64 min-h-[80px] overflow-y-auto rounded-lg border border-surface-3 dark:border-gray-700">
          {search.trim().length <= 1 ? (
            <p className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
              {t('merge.minChars')}
            </p>
          ) : isFetching ? (
            <p className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
              {t('merge.searching')}
            </p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
              {t('merge.noResults')}
            </p>
          ) : (
            <ul className="divide-y divide-surface-2 dark:divide-gray-700/70">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => mergeMutation.mutate(item.id)}
                    disabled={mergeMutation.isPending}
                    className={clsx(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      'hover:bg-surface-1 disabled:opacity-50 dark:hover:bg-gray-700/50',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-800 dark:text-gray-200">
                      {item.title}
                    </span>
                    <StatusBadge status={item.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}
