import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchRoadmap } from '../api';
import type { RoadmapData, RoadmapItem } from '../types';
import { statusLabel } from '../lib/labels';
import { usePageMeta } from '../lib/meta';
import { PageHeader } from '../components/PageHeader';
import { CategoryPill, CountBadge } from '../components/Badges';
import { ArrowUpIcon, ChevronRightIcon, LayersIcon } from '../components/Icons';
import { EmptyState, ErrorState, RoadmapSkeleton } from '../components/States';

interface ColumnView {
  key: string;
  label: string;
  color: string;
  items: RoadmapItem[];
}

const DEFAULT_COLUMNS = [
  { key: 'planned' as const, labelKey: 'roadmap.planned', color: '#F59E0B' },
  {
    key: 'in_progress' as const,
    labelKey: 'roadmap.inProgress',
    color: '#0EA5E9',
  },
  { key: 'completed' as const, labelKey: 'roadmap.completed', color: '#10B981' },
];

function RoadmapCard({ item, to }: { item: RoadmapItem; to: string }) {
  const { t } = useTranslation();
  return (
    <Link
      to={to}
      className="group block rounded-control border border-line-subtle bg-surface p-3.5 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift"
    >
      <h3 className="line-clamp-2 text-13 font-semibold leading-snug text-ink transition-colors duration-150 group-hover:text-brand">
        {item.title}
      </h3>
      <div className="mt-2.5 flex items-center gap-2">
        <CategoryPill category={item.category} />
        <span className="ml-auto inline-flex items-center gap-1 text-11 text-ink-tertiary">
          <ArrowUpIcon className="h-3 w-3" aria-hidden="true" />
          <span className="tnum">{item.vote_count}</span>
          <span className="sr-only">{t('common.voteCount')}</span>
        </span>
      </div>
    </Link>
  );
}

export function Roadmap({ projectName }: { projectName: string }) {
  const { t } = useTranslation();
  const { projectSlug } = useParams<{ projectSlug: string }>();
  const base = `/${projectSlug ?? ''}`;
  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  usePageMeta({
    title: t('meta.roadmapTitle', { project: projectName }),
    description: t('roadmap.subtitle'),
    siteName: projectName,
    path: `${base}/roadmap`,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await fetchRoadmap());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const columns = useMemo<ColumnView[]>(() => {
    if (!data) return [];
    if (data.columns && data.columns.length > 0) {
      return data.columns.map((column) => ({
        key: column.key,
        label: statusLabel(t, column.name),
        color: column.color,
        items: column.items,
      }));
    }
    return DEFAULT_COLUMNS.map((column) => ({
      key: column.key,
      label: t(column.labelKey),
      color: column.color,
      items: data[column.key] ?? [],
    }));
  }, [data, t]);

  const gridClass =
    columns.length === 2
      ? 'md:grid-cols-2'
      : columns.length >= 4
        ? 'md:grid-cols-2 xl:grid-cols-4'
        : 'md:grid-cols-3';

  const isEmpty =
    !loading && !error && columns.every((column) => column.items.length === 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <PageHeader title={t('roadmap.title')} subtitle={t('roadmap.subtitle')} />

      {loading ? (
        <RoadmapSkeleton label={t('roadmap.skeletonLabel')} />
      ) : error ? (
        <ErrorState
          title={t('roadmap.errorTitle')}
          description={t('roadmap.errorDescription')}
          retryLabel={t('common.retry')}
          onRetry={() => void loadData()}
        />
      ) : isEmpty ? (
        <EmptyState
          icon={<LayersIcon className="h-5 w-5" />}
          title={t('roadmap.emptyTitle')}
          description={t('roadmap.emptyDescription')}
        />
      ) : (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-11 text-ink-tertiary md:hidden">
            <ChevronRightIcon className="h-3 w-3" aria-hidden="true" />
            {t('roadmap.swipeHint')}
          </p>
          <div
            className={`relative -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:grid md:gap-5 md:overflow-visible md:px-0 md:pb-0 ${gridClass}`}
          >
            {columns.map((column) => (
              <section
                key={column.key}
                className="w-[85vw] max-w-[320px] shrink-0 snap-start rounded-card border border-line-subtle bg-surface-subtle/60 md:w-auto md:max-w-none"
                aria-label={column.label}
              >
                <header className="flex items-center gap-2 rounded-t-card border-b border-line-subtle bg-surface-subtle px-3.5 py-2.5 md:sticky md:top-14 md:z-10">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: column.color }}
                    aria-hidden="true"
                  />
                  <h2 className="text-13 font-semibold text-ink">{column.label}</h2>
                  <CountBadge>{column.items.length}</CountBadge>
                </header>
                <div className="space-y-2.5 p-2.5">
                  {column.items.map((item) => (
                    <RoadmapCard
                      key={item.id}
                      item={item}
                      to={`${base}/feedback/${item.id}`}
                    />
                  ))}
                  {column.items.length === 0 && (
                    <p className="rounded-control border border-dashed border-line-strong/60 px-3 py-8 text-center text-12 text-ink-tertiary">
                      {t('roadmap.emptyColumn')}
                    </p>
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
