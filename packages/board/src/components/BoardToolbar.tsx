import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  STATUS_FILTERS,
  STATUS_DOT_CLASS,
  statusLabel,
  statusTone,
} from '../lib/labels';
import {
  CloseIcon,
  SearchIcon,
  TrendingUpIcon,
  ClockIcon,
} from './Icons';

export type SortKey = 'votes' | 'created_at';

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface BoardToolbarProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  sortBy: SortKey;
  onSortChange: (value: SortKey) => void;
  status: string;
  onStatusChange: (value: string) => void;
  statusCounts: Record<string, number>;
  visibleCount: number;
  totalCount: number;
  chips: FilterChip[];
  onClearAll: () => void;
}

function SortButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-7 items-center gap-1.5 rounded-[7px] px-2.5 text-12 font-medium transition-colors duration-150 ${
        active
          ? 'bg-surface text-ink shadow-card'
          : 'text-ink-tertiary hover:text-ink'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function BoardToolbar({
  keyword,
  onKeywordChange,
  sortBy,
  onSortChange,
  status,
  onStatusChange,
  statusCounts,
  visibleCount,
  totalCount,
  chips,
  onClearAll,
}: BoardToolbarProps) {
  const { t } = useTranslation();

  return (
    <section className="card p-3 sm:p-4" aria-label={t('home.filtersLabel')}>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary"
            aria-hidden="true"
          />
          <input
            type="search"
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            placeholder={t('home.searchPlaceholder')}
            aria-label={t('home.searchLabel')}
            className="field pl-9 pr-10"
          />
          {keyword && (
            <button
              type="button"
              onClick={() => onKeywordChange('')}
              className="icon-btn absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
              aria-label={t('common.clearSearch')}
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <div
            role="group"
            aria-label={t('home.sortLabel')}
            className="inline-flex items-center gap-0.5 rounded-control border border-line-subtle bg-surface-subtle p-0.5"
          >
            <SortButton
              active={sortBy === 'votes'}
              onClick={() => onSortChange('votes')}
              label={t('home.sortHottest')}
              icon={<TrendingUpIcon className="h-3.5 w-3.5" aria-hidden="true" />}
            />
            <SortButton
              active={sortBy === 'created_at'}
              onClick={() => onSortChange('created_at')}
              label={t('home.sortNewest')}
              icon={<ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          </div>
          <p className="tnum text-12 text-ink-tertiary sm:hidden">
            {t('home.resultCount', { count: visibleCount })}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onStatusChange('')}
          aria-pressed={status === ''}
          className={status === '' ? 'chip-active' : 'chip-idle'}
        >
          {t('common.all')}
        </button>
        {STATUS_FILTERS.map((value) => {
          const active = status === value;
          const count = statusCounts[value] ?? 0;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onStatusChange(value)}
              aria-pressed={active}
              className={active ? 'chip-active' : 'chip-idle'}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[statusTone(value)]}`}
                aria-hidden="true"
              />
              {statusLabel(t, value)}
              <span className="tnum text-ink-tertiary">{count}</span>
            </button>
          );
        })}
        <span className="tnum ml-auto hidden text-12 text-ink-tertiary sm:block">
          {visibleCount === totalCount
            ? t('home.resultCount', { count: totalCount })
            : t('home.resultCountFiltered', {
                visible: visibleCount,
                total: totalCount,
              })}
        </span>
      </div>

      {chips.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line-subtle pt-2.5">
          <span className="text-11 font-medium text-ink-tertiary">
            {t('home.activeFilters')}
          </span>
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex h-7 items-center gap-1 rounded-pill border border-brand/25 bg-brand-soft pl-2.5 pr-1 text-11 font-medium text-brand"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors duration-150 hover:bg-brand/10"
                aria-label={t('common.removeFilter', { label: chip.label })}
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="ml-1 text-11 font-medium text-ink-tertiary underline-offset-2 transition-colors hover:text-ink hover:underline"
          >
            {t('common.clearFilters')}
          </button>
        </div>
      )}
    </section>
  );
}
