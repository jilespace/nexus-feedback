import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchChangelog } from '../api';
import type { ChangelogEntry } from '../types';
import { formatDate } from '../lib/labels';
import Markdown from '../components/Markdown';
import { PageHeader } from '../components/PageHeader';
import { SparkIcon } from '../components/Icons';
import {
  ChangelogSkeleton,
  EmptyState,
  ErrorState,
} from '../components/States';

export function Changelog() {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setEntries(await fetchChangelog());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <PageHeader
        title={t('changelog.title')}
        subtitle={t('changelog.subtitle')}
      />

      {loading ? (
        <ChangelogSkeleton label={t('changelog.skeletonLabel')} />
      ) : error ? (
        <ErrorState
          title={t('changelog.errorTitle')}
          description={t('changelog.errorDescription')}
          retryLabel={t('common.retry')}
          onRetry={() => void loadData()}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<SparkIcon className="h-5 w-5" />}
          title={t('changelog.emptyTitle')}
          description={t('changelog.emptyDescription')}
        />
      ) : (
        <div className="relative">
          <span
            className="absolute bottom-2 left-[5px] top-2 w-px bg-line-subtle md:left-[148px]"
            aria-hidden="true"
          />
          <div className="space-y-8 md:space-y-10">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className="relative pl-6 md:grid md:grid-cols-[132px_1fr] md:gap-8 md:pl-0"
              >
                <span
                  className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-brand bg-surface md:left-[143px] md:top-[9px]"
                  aria-hidden="true"
                />
                <time
                  dateTime={entry.published_at}
                  className="block text-12 font-medium text-ink-tertiary md:pt-1.5 md:text-right"
                >
                  {formatDate(entry.published_at, i18n.language)}
                </time>
                <div className="card mt-2 p-4 sm:p-5 md:mt-0">
                  <h2 className="text-16 font-semibold leading-snug text-ink">
                    {entry.title}
                  </h2>
                  <div className="mt-2">
                    <Markdown content={entry.content} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
