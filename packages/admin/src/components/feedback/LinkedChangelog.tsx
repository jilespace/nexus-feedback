import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/api/client';
import { Badge, Button, Card, Skeleton } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { SearchIcon } from '@/components/icons';
import { formatDateTime, markdownToPlainText } from '@/utils/markdown';
import type { ChangelogEntry } from '@/types';

interface LinkedChangelogProps {
  feedbackId: string;
  projectId: string;
}

const CHANGELOG_PAGE_SIZE = 100;

function linkedFeedbackIds(entry: ChangelogEntry): string[] {
  return (entry.feedbacks ?? []).map((feedback) => feedback.id);
}

/**
 * Sidebar card that links a feedback to published changelogs of the same project.
 * `GET /org/changelog?project_id=` is the existing list API; the linked entries are
 * the ones reporting this feedback in their `feedbacks` array.
 */
export function LinkedChangelog({ feedbackId, projectId }: LinkedChangelogProps) {
  const { t } = useTranslation('detail');
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['changelog', 'project', projectId],
    queryFn: () =>
      apiRequest<{ items: ChangelogEntry[] }>(
        `/org/changelog?project_id=${projectId}&page_size=${CHANGELOG_PAGE_SIZE}`,
      ),
  });

  const entries = data?.items ?? [];
  const linked = useMemo(
    () => entries.filter((entry) => linkedFeedbackIds(entry).includes(feedbackId)),
    [entries, feedbackId],
  );
  const candidates = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const linkedIds = new Set(linked.map((entry) => entry.id));
    return entries.filter(
      (entry) =>
        entry.published &&
        !linkedIds.has(entry.id) &&
        (!keyword || entry.title.toLowerCase().includes(keyword)),
    );
  }, [entries, linked, search]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['changelog'] });
    void queryClient.invalidateQueries({ queryKey: ['feedback', feedbackId] });
  };

  const closeModal = () => {
    setModalOpen(false);
    setSearch('');
  };

  const linkMutation = useMutation({
    mutationFn: (changelogId: string) =>
      apiRequest(`/org/changelog/${changelogId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ feedback_id: feedbackId }),
      }),
    onSuccess: (_data, changelogId) => {
      const entry = entries.find((item) => item.id === changelogId);
      toast.show(t('changelog.linked', { title: entry?.title ?? '' }));
      invalidate();
      closeModal();
    },
    onError: (err) =>
      toast.show(err instanceof Error ? err.message : t('changelog.linkFailed'), 'error'),
  });

  const unlinkMutation = useMutation({
    mutationFn: (changelogId: string) =>
      apiRequest(`/org/changelog/${changelogId}/feedback/${feedbackId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      toast.show(t('changelog.unlinked'));
      invalidate();
    },
    onError: (err) =>
      toast.show(err instanceof Error ? err.message : t('changelog.unlinkFailed'), 'error'),
  });

  return (
    <>
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500">
            {t('changelog.title')}
          </h3>
          {linked.length > 0 && (
            <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
              {t('changelog.linkedCount', { num: linked.length })}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : linked.length === 0 ? (
          <p className="text-xs leading-relaxed text-gray-400 dark:text-gray-500">
            {t('changelog.emptyDescription')}
          </p>
        ) : (
          <ul className="space-y-2">
            {linked.map((entry) => {
              const expanded = expandedId === entry.id;
              const summary = markdownToPlainText(entry.content).slice(0, 140);
              return (
                <li
                  key={entry.id}
                  className="rounded-lg border border-surface-3 bg-surface-1/40 p-2.5 dark:border-gray-700/70 dark:bg-gray-900/30"
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : entry.id)}
                      aria-expanded={expanded}
                      className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                    >
                      <span className="block truncate text-[13px] font-medium text-gray-800 dark:text-gray-200">
                        {entry.title}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone={entry.published ? 'green' : 'gray'}>
                          {entry.published ? t('changelog.published') : t('changelog.draft')}
                        </Badge>
                        <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                          {formatDateTime(entry.published_at ?? entry.created_at)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/changelog?highlight=${entry.id}`)}
                      aria-label={t('changelog.viewInChangelogAria', { title: entry.title })}
                      title={t('changelog.viewInChangelog')}
                      className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-surface-2 hover:text-brand-600 dark:hover:bg-gray-700 dark:hover:text-brand-400"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path
                          d="M6 3.5h6.5V10M12.5 3.5 3.5 12.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => unlinkMutation.mutate(entry.id)}
                      disabled={unlinkMutation.isPending}
                      aria-label={t('changelog.unlinkAria', { title: entry.title })}
                      title={t('changelog.unlink')}
                      className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-rose-500/10"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path
                          d="m4 4 8 8M12 4l-8 8"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                  {expanded && summary && (
                    <p className="mt-2 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                      {summary}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <Button
          variant="secondary"
          size="sm"
          className="mt-3 w-full"
          onClick={() => setModalOpen(true)}
        >
          {t('changelog.link')}
        </Button>
      </Card>

      {modalOpen && (
        <Modal
          title={t('changelog.modalTitle')}
          description={t('changelog.modalDescription')}
          size="md"
          onClose={closeModal}
          footer={
            <Button variant="secondary" size="sm" onClick={closeModal}>
              {t('actions.cancel')}
            </Button>
          }
        >
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('changelog.searchPlaceholder')}
              autoFocus
              className="h-9 w-full rounded-lg border border-surface-3 bg-surface-1/60 pl-9 pr-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100"
            />
          </div>
          <div className="mt-2 max-h-72 min-h-[80px] overflow-y-auto rounded-lg border border-surface-3 dark:border-gray-700">
            {isLoading ? (
              <p className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
                {t('changelog.loading')}
              </p>
            ) : candidates.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
                {t('changelog.noCandidates')}
              </p>
            ) : (
              <ul className="divide-y divide-surface-2 dark:divide-gray-700/70">
                {candidates.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => linkMutation.mutate(entry.id)}
                      disabled={linkMutation.isPending}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-1 disabled:opacity-50 dark:hover:bg-gray-700/50"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-800 dark:text-gray-200">
                        {entry.title}
                      </span>
                      <Badge tone="green">{t('changelog.published')}</Badge>
                      <span className="shrink-0 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                        {formatDateTime(entry.published_at ?? entry.created_at)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
