import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { fetchFeedbackList, fetchProjectCategories } from '../api';
import type { FeedbackItem, ProjectCategory } from '../types';
import {
  categoryLabel,
  STATUS_FILTERS,
  statusLabel,
} from '../lib/labels';
import { emptyStats, type CategoryOption, type BoardStats } from '../lib/board';
import { PageHeader } from '../components/PageHeader';
import {
  BoardToolbar,
  type FilterChip,
  type SortKey,
} from '../components/BoardToolbar';
import {
  BoardSidebar,
  CategoryChips,
  SubmitCtaCard,
} from '../components/BoardSidebar';
import { FeedbackCard } from '../components/FeedbackCard';
import {
  EmptyState,
  ErrorState,
  FeedbackListSkeleton,
} from '../components/States';
import { SubmitModal } from '../components/SubmitModal';
import { InboxIcon, SearchIcon } from '../components/Icons';

function matchesKeyword(item: FeedbackItem, keyword: string): boolean {
  if (!keyword) return true;
  return `${item.title} ${item.content ?? ''}`
    .toLowerCase()
    .includes(keyword);
}

export function BoardHome() {
  const { t } = useTranslation();
  const { projectSlug } = useParams<{ projectSlug: string }>();
  const base = `/${projectSlug ?? ''}`;

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('votes');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [showModal, setShowModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetchFeedbackList({
        sort_by: 'created_at',
        page_size: 100,
      });
      setItems(response.items);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void fetchProjectCategories().then(setCategories);
  }, []);

  const normalizedKeyword = keyword.trim().toLowerCase();

  const visibleItems = useMemo(() => {
    const matched = items.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (categoryFilter && item.category !== categoryFilter) return false;
      return matchesKeyword(item, normalizedKeyword);
    });
    return matched.sort((a, b) => {
      if (sortBy === 'votes' && a.vote_count !== b.vote_count) {
        return b.vote_count - a.vote_count;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [items, statusFilter, categoryFilter, normalizedKeyword, sortBy]);

  const categoryOptions = useMemo<CategoryOption[]>(() => {
    const counts = new Map<string, number>();
    for (const category of categories) counts.set(category.name, 0);
    for (const item of items) {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count }));
  }, [categories, items]);

  const stats = useMemo<BoardStats>(() => {
    if (items.length === 0) return emptyStats;
    return {
      total: items.length,
      inProgress: items.filter((item) => item.status === 'in_progress').length,
      resolved: items.filter((item) => item.status === 'resolved').length,
      votes: items.reduce((sum, item) => sum + item.vote_count, 0),
    };
  }, [items]);

  const statusCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const status of STATUS_FILTERS) counts[status] = 0;
    for (const item of items) {
      if (categoryFilter && item.category !== categoryFilter) continue;
      if (!matchesKeyword(item, normalizedKeyword)) continue;
      counts[item.status] = (counts[item.status] ?? 0) + 1;
    }
    return counts;
  }, [items, categoryFilter, normalizedKeyword]);

  const filterChips: FilterChip[] = [];
  if (statusFilter) {
    filterChips.push({
      key: 'status',
      label: statusLabel(t, statusFilter),
      onRemove: () => setStatusFilter(''),
    });
  }
  if (categoryFilter) {
    filterChips.push({
      key: 'category',
      label: categoryLabel(t, categoryFilter),
      onRemove: () => setCategoryFilter(''),
    });
  }
  if (keyword.trim()) {
    filterChips.push({
      key: 'keyword',
      label: t('home.keywordChip', { keyword: keyword.trim() }),
      onRemove: () => setKeyword(''),
    });
  }

  function clearAllFilters() {
    setStatusFilter('');
    setCategoryFilter('');
    setKeyword('');
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <PageHeader
        title={t('home.title')}
        subtitle={t('home.subtitle')}
        size="hero"
      />

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-3.5 lg:col-span-2">
          <SubmitCtaCard
            variant="compact"
            onOpen={() => setShowModal(true)}
          />

          <CategoryChips
            categories={categoryOptions}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />

          <BoardToolbar
            keyword={keyword}
            onKeywordChange={setKeyword}
            sortBy={sortBy}
            onSortChange={setSortBy}
            status={statusFilter}
            onStatusChange={setStatusFilter}
            statusCounts={statusCounts}
            visibleCount={visibleItems.length}
            totalCount={items.length}
            chips={filterChips}
            onClearAll={clearAllFilters}
          />

          {loading ? (
            <FeedbackListSkeleton label={t('home.skeletonLabel')} count={5} />
          ) : error ? (
            <ErrorState
              title={t('home.errorTitle')}
              description={t('home.errorDescription')}
              retryLabel={t('common.retry')}
              onRetry={() => void loadData()}
            />
          ) : visibleItems.length === 0 ? (
            filterChips.length > 0 ? (
              <EmptyState
                icon={<SearchIcon className="h-5 w-5" />}
                title={t('home.noResultsTitle')}
                description={t('home.noResultsDescription')}
                action={
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="btn-secondary"
                  >
                    {t('common.clearFilters')}
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon={<InboxIcon className="h-5 w-5" />}
                title={t('home.emptyTitle')}
                description={t('home.emptyDescription')}
                action={
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="btn-primary"
                  >
                    {t('home.emptyAction')}
                  </button>
                }
              />
            )
          ) : (
            <div className="space-y-3">
              {visibleItems.map((item, index) => (
                <FeedbackCard
                  key={item.id}
                  item={item}
                  index={index}
                  to={`${base}/feedback/${item.id}`}
                />
              ))}
            </div>
          )}
        </div>

        <BoardSidebar
          stats={stats}
          loading={loading}
          categories={categoryOptions}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          onOpenSubmit={() => setShowModal(true)}
        />
      </div>

      {showModal && (
        <SubmitModal
          onClose={() => setShowModal(false)}
          onSubmitted={() => void loadData()}
        />
      )}
    </div>
  );
}
