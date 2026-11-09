import { useTranslation } from 'react-i18next';
import { categoryColor, categoryLabel, formatNumber } from '../lib/labels';
import type { BoardStats, CategoryOption } from '../lib/board';
import { SparkIcon } from './Icons';
import { SidebarStatsSkeleton } from './States';

export function SubmitCtaCard({
  onOpen,
  variant = 'rich',
}: {
  onOpen: () => void;
  variant?: 'rich' | 'compact';
}) {
  const { t } = useTranslation();

  if (variant === 'compact') {
    return (
      <section
        className="card flex items-center gap-3 p-3.5 lg:hidden"
        aria-label={t('sidebar.ctaTitle')}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
          <SparkIcon className="h-[18px] w-[18px]" aria-hidden="true" />
        </div>
        <p className="min-w-0 flex-1 truncate text-13 font-semibold text-ink">
          {t('sidebar.ctaTitle')}
        </p>
        <button type="button" onClick={onOpen} className="btn-primary btn-sm shrink-0">
          {t('sidebar.ctaAction')}
        </button>
      </section>
    );
  }

  return (
    <section className="card hidden p-4 lg:block" aria-label={t('sidebar.ctaTitle')}>
      <div className="flex h-9 w-9 items-center justify-center rounded-control bg-brand-soft text-brand">
        <SparkIcon className="h-[18px] w-[18px]" aria-hidden="true" />
      </div>
      <h2 className="mt-3 text-14 font-semibold text-ink">
        {t('sidebar.ctaTitle')}
      </h2>
      <p className="mt-1 text-12 leading-relaxed text-ink-secondary">
        {t('sidebar.ctaDescription')}
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="btn-primary mt-3.5 w-full"
      >
        {t('sidebar.ctaAction')}
      </button>
    </section>
  );
}

export function CategoryChips({
  categories,
  value,
  onChange,
}: {
  categories: CategoryOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden"
      role="group"
      aria-label={t('home.filterByCategory')}
    >
      <button
        type="button"
        onClick={() => onChange('')}
        aria-pressed={value === ''}
        className={value === '' ? 'chip-active' : 'chip-idle'}
      >
        {t('sidebar.allCategories')}
      </button>
      {categories.map((category) => (
        <button
          key={category.name}
          type="button"
          onClick={() => onChange(category.name)}
          aria-pressed={value === category.name}
          className={value === category.name ? 'chip-active' : 'chip-idle'}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: categoryColor(category.name) }}
            aria-hidden="true"
          />
          {categoryLabel(t, category.name)}
        </button>
      ))}
    </div>
  );
}

function StatCell({ value, label }: { value: number; label: string }) {
  const { i18n } = useTranslation();
  return (
    <div>
      <p className="tnum text-22 font-semibold leading-none text-ink">
        {formatNumber(value, i18n.language)}
      </p>
      <p className="mt-1.5 text-11 text-ink-tertiary">{label}</p>
    </div>
  );
}

export function BoardSidebar({
  stats,
  loading,
  categories,
  categoryFilter,
  onCategoryChange,
  onOpenSubmit,
}: {
  stats: BoardStats;
  loading: boolean;
  categories: CategoryOption[];
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  onOpenSubmit: () => void;
}) {
  const { t } = useTranslation();

  return (
    <aside
      className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start"
      aria-label={t('sidebar.landmark')}
    >
      <SubmitCtaCard onOpen={onOpenSubmit} />

      <section className="card p-4" aria-labelledby="board-stats-title">
        <h2
          id="board-stats-title"
          className="text-13 font-semibold text-ink"
        >
          {t('sidebar.statsTitle')}
        </h2>
        <div className="mt-3.5">
          {loading ? (
            <SidebarStatsSkeleton />
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <StatCell value={stats.total} label={t('sidebar.statsTotal')} />
              <StatCell
                value={stats.inProgress}
                label={t('sidebar.statsInProgress')}
              />
              <StatCell
                value={stats.resolved}
                label={t('sidebar.statsResolved')}
              />
              <StatCell value={stats.votes} label={t('sidebar.statsVotes')} />
            </div>
          )}
        </div>
      </section>

      <section
        className="card hidden p-4 lg:block"
        aria-labelledby="board-categories-title"
      >
        <h2
          id="board-categories-title"
          className="text-13 font-semibold text-ink"
        >
          {t('sidebar.categoriesTitle')}
        </h2>
        <div className="mt-2 space-y-0.5">
          <button
            type="button"
            onClick={() => onCategoryChange('')}
            aria-pressed={categoryFilter === ''}
            className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-12 transition-colors duration-150 ${
              categoryFilter === ''
                ? 'bg-brand-soft font-medium text-brand'
                : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink'
            }`}
          >
            <span className="truncate">{t('sidebar.allCategories')}</span>
            <span className="tnum ml-auto text-11 text-ink-tertiary">
              {stats.total}
            </span>
          </button>
          {categories.map((category) => {
            const active = categoryFilter === category.name;
            return (
              <button
                key={category.name}
                type="button"
                onClick={() => onCategoryChange(category.name)}
                aria-pressed={active}
                className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-12 transition-colors duration-150 ${
                  active
                    ? 'bg-brand-soft font-medium text-brand'
                    : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink'
                }`}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: categoryColor(category.name) }}
                  aria-hidden="true"
                />
                <span className="truncate">
                  {categoryLabel(t, category.name)}
                </span>
                <span className="tnum ml-auto text-11 text-ink-tertiary">
                  {category.count}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
