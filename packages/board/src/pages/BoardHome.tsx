import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { fetchFeedbackList, fetchProjectCategories } from '../api';
import type { FeedbackItem, ProjectCategory } from '../types';
import {
  categoryLabel,
  STATUS_FILTERS,
  statusLabel,
} from '../lib/labels';
import { emptyStats, type CategoryOption, type BoardStats } from '../lib/board';
import {
  buildBoardSearch,
  readBoardFilters,
  type BoardFilters,
} from '../lib/urlFilters';
import { usePageMeta } from '../lib/meta';
import { PageHeader } from '../components/PageHeader';
import { ShareButton } from '../components/ShareButton';
import {
  BoardToolbar,
  type FilterChip,
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

const SEARCH_DEBOUNCE_MS = 300;

function matchesKeyword(item: FeedbackItem, keyword: string): boolean {
  if (!keyword) return true;
  return `${item.title} ${item.content ?? ''}`
    .toLowerCase()
    .includes(keyword);
}

function searchToParams(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
}

export function BoardHome({ projectName }: { projectName: string }) {
  const { t } = useTranslation();
  const { projectSlug } = useParams<{ projectSlug: string }>();
  const base = `/${projectSlug ?? ''}`;
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readBoardFilters(searchParams.toString());

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [keyword, setKeyword] = useState(filters.keyword);
  const [showModal, setShowModal] = useState(false);
  const lastPushedKeywordRef = useRef(filters.keyword);

  // Filter/sort changes are written with history.replaceState (through the
  // router) so they never add extra history entries.
  const applyFilters = useCallback(
    (patch: Partial<BoardFilters>) => {
      setSearchParams(
        (previous) => {
          const current = readBoardFilters(previous.toString());
          const next = buildBoardSearch({ ...current, ...patch });
          return searchToParams(next);
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const pageTitle = t('meta.homeTitle', { project: projectName });
  const currentSearch = searchParams.toString();
  const sharePath = currentSearch ? `${base}?${currentSearch}` : base;
  usePageMeta({
    title: pageTitle,
    description: t('home.subtitle'),
    siteName: projectName,
    path: base,
  });

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

  // Canonicalise a hand-edited link once on load: invalid/duplicate/default
  // parameters are dropped so the address bar always reflects the real state.
  useEffect(() => {
    const current = window.location.search;
    const canonical = buildBoardSearch(readBoardFilters(current));
    if (canonical !== current) {
      setSearchParams(searchToParams(canonical), { replace: true });
    }
    // Runs only on mount; later changes are handled by the filter actions.
  }, []);

  // Search typing stays local for instant feedback; the URL `q` param is only
  // written 300ms after the user stops typing.
  useEffect(() => {
    const trimmed = keyword.trim();
    if (trimmed === filters.keyword) return;
    const timer = window.setTimeout(() => {
      lastPushedKeywordRef.current = trimmed;
      applyFilters({ keyword: trimmed });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [keyword, filters.keyword, applyFilters]);

  // URL -> input: applies on load and on browser back/forward (popstate). A
  // value we just pushed ourselves never overwrites what is being typed.
  useEffect(() => {
    if (filters.keyword === keyword.trim()) return;
    if (filters.keyword === lastPushedKeywordRef.current) return;
    lastPushedKeywordRef.current = filters.keyword;
    setKeyword(filters.keyword);
  }, [filters.keyword, keyword]);

  // A hand-edited URL may contain a category this project does not have; drop
  // it once the feedback/category data has loaded.
  useEffect(() => {
    if (!filters.category || loading) return;
    const known =
      categories.some((category) => category.name === filters.category) ||
      items.some((item) => item.category === filters.category);
    if (!known) applyFilters({ category: '' });
  }, [filters.category, loading, categories, items, applyFilters]);

  const normalizedKeyword = keyword.trim().toLowerCase();

  const visibleItems = useMemo(() => {
    const matched = items.filter((item) => {
      if (filters.status && item.status !== filters.status) return false;
      if (filters.category && item.category !== filters.category) return false;
      return matchesKeyword(item, normalizedKeyword);
    });
    return matched.sort((a, b) => {
      if (filters.sort === 'votes' && a.vote_count !== b.vote_count) {
        return b.vote_count - a.vote_count;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [items, filters.status, filters.category, filters.sort, normalizedKeyword]);

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
      if (filters.category && item.category !== filters.category) continue;
      if (!matchesKeyword(item, normalizedKeyword)) continue;
      counts[item.status] = (counts[item.status] ?? 0) + 1;
    }
    return counts;
  }, [items, filters.category, normalizedKeyword]);

  const filterChips: FilterChip[] = [];
  if (filters.status) {
    filterChips.push({
      key: 'status',
      label: statusLabel(t, filters.status),
      onRemove: () => applyFilters({ status: '' }),
    });
  }
  if (filters.category) {
    filterChips.push({
      key: 'category',
      label: categoryLabel(t, filters.category),
      onRemove: () => applyFilters({ category: '' }),
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
    applyFilters({ status: '', category: '' });
    setKeyword('');
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <PageHeader
        title={t('home.title')}
        subtitle={t('home.subtitle')}
        size="hero"
        action={
          <ShareButton
            path={sharePath}
            title={pageTitle}
            ariaLabel={t('share.ariaBoard')}
          />
        }
      />

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-3.5 lg:col-span-2">
          <SubmitCtaCard
            variant="compact"
            onOpen={() => setShowModal(true)}
          />

          <CategoryChips
            categories={categoryOptions}
            value={filters.category}
            onChange={(value) => applyFilters({ category: value })}
          />

          <BoardToolbar
            keyword={keyword}
            onKeywordChange={setKeyword}
            sortBy={filters.sort}
            onSortChange={(value) => applyFilters({ sort: value })}
            status={filters.status}
            onStatusChange={(value) => applyFilters({ status: value })}
            statusCounts={statusCounts}
            visibleCount={visibleItems.length}
            totalCount={items.length}
            chips={filterChips}
            onClearAll={clearAllFilters}
          />

          {loading ? (
            <FeedbackListSkeleton label={t('home.skeletonLabel')} count={8} />
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
          categoryFilter={filters.category}
          onCategoryChange={(value) => applyFilters({ category: value })}
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
