import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { fetchChangelog } from '../api';
import type { ChangelogEntry } from '../types';
import { formatDate } from '../lib/labels';
import { canonicalUrl, usePageMeta } from '../lib/meta';
import { buildChangelogJsonLd } from '../lib/seo';
import { changelogFeedPath, changelogRssLabel } from '../lib/changelogFeed';
import Markdown from '../components/Markdown';
import { PageHeader } from '../components/PageHeader';
import { SparkIcon } from '../components/Icons';
import {
  ChangelogSkeleton,
  EmptyState,
  ErrorState,
} from '../components/States';

export function Changelog({ projectName }: { projectName: string }) {
  const { t, i18n } = useTranslation();
  const { projectSlug } = useParams<{ projectSlug: string }>();
  const base = `/${projectSlug ?? ''}`;
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const pageTitle = t('meta.changelogTitle', { project: projectName });
  const rssLabels = changelogRssLabel(i18n.language);
  usePageMeta({
    title: pageTitle,
    description: t('changelog.subtitle'),
    siteName: projectName,
    path: `${base}/changelog`,
    jsonLd:
      entries.length > 0
        ? buildChangelogJsonLd(entries, {
            name: pageTitle,
            description: t('changelog.subtitle'),
            url: canonicalUrl(`${base}/changelog`),
            language: i18n.language.startsWith('zh') ? 'zh-CN' : 'en',
          })
        : null,
  });

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
        action={
          <a
            href={changelogFeedPath(projectSlug)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            aria-label={rssLabels.ariaLabel}
            title={rssLabels.ariaLabel}
          >
            {rssLabels.action}
          </a>
        }
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
          <div className="space-y-6 md:space-y-10">
            {entries.map((entry) => {
              const isPublished = entry.published !== false;
              return (
                <article
                  key={entry.id}
                  id={`changelog-${entry.id}`}
                  className="relative scroll-mt-20 pl-6 md:grid md:grid-cols-[132px_1fr] md:gap-8 md:pl-0"
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
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <h2 className="text-16 font-semibold leading-snug text-ink">
                        {entry.title}
                      </h2>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-line-subtle bg-surface-subtle px-2 py-[3px] text-11 font-medium ${
                          isPublished ? 'text-ink-secondary' : 'text-ink-tertiary'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${isPublished ? 'bg-success' : 'bg-ink-tertiary'}`}
                          aria-hidden="true"
                        />
                        {isPublished
                          ? t('changelog.published')
                          : t('changelog.draft')}
                      </span>
                    </div>
                    <div className="mt-2.5">
                      <Markdown content={entry.content} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
