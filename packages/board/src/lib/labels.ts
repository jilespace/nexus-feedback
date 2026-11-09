import type { TFunction } from 'i18next';

/**
 * 分类名中文化（docs/UI_REDESIGN.md §4.2）。
 * 只映射契约中约定的分类；未知分类原样展示。
 */
const CATEGORY_I18N: Record<string, string> = {
  bug: 'category.bug',
  feature: 'category.feature',
  performance: 'category.performance',
  ui: 'category.ui',
  other: 'category.other',
};

/** 契约 §2.1 分类色板，按项目默认分类顺序取色；未知分类用稳定哈希兜底。 */
const CATEGORY_COLORS: Record<string, string> = {
  bug: '#6366F1',
  feature: '#F59E0B',
  performance: '#0EA5E9',
  ui: '#10B981',
  other: '#8B5CF6',
};

const FALLBACK_PALETTE = [
  '#6366F1',
  '#F59E0B',
  '#0EA5E9',
  '#10B981',
  '#8B5CF6',
  '#EC4899',
  '#64748B',
];

export function categoryLabel(t: TFunction, category: string): string {
  const key = CATEGORY_I18N[category];
  return key ? t(key) : category;
}

export function categoryColor(category: string): string {
  const known = CATEGORY_COLORS[category];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < category.length; i += 1) {
    hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length] ?? '#64748B';
}

const STATUS_I18N: Record<string, string> = {
  open: 'status.open',
  in_progress: 'status.in_progress',
  resolved: 'status.resolved',
  closed: 'status.closed',
};

export const STATUS_FILTERS = ['open', 'in_progress', 'resolved', 'closed'];

export type StatusTone =
  | 'open'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'neutral';

const STATUS_TONES: Record<string, StatusTone> = {
  open: 'open',
  in_progress: 'in_progress',
  resolved: 'resolved',
  closed: 'closed',
};

export function statusLabel(t: TFunction, status: string): string {
  const key = STATUS_I18N[status];
  return key ? t(key) : status;
}

export function statusTone(status: string): StatusTone {
  return STATUS_TONES[status] ?? 'neutral';
}

export const STATUS_BADGE_CLASS: Record<StatusTone, string> = {
  open: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25',
  in_progress:
    'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/25',
  resolved:
    'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/25',
  closed:
    'bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-400/10 dark:text-slate-300 dark:ring-slate-400/20',
  neutral: 'bg-surface-subtle text-ink-secondary ring-line-strong/40',
};

export const STATUS_DOT_CLASS: Record<StatusTone, string> = {
  open: 'bg-amber-500 dark:bg-amber-400',
  in_progress: 'bg-sky-500 dark:bg-sky-400',
  resolved: 'bg-emerald-500 dark:bg-emerald-400',
  closed: 'bg-slate-400 dark:bg-slate-500',
  neutral: 'bg-ink-tertiary',
};

const SOURCE_I18N: Record<string, string> = {
  board: 'source.board',
  api: 'source.api',
  widget: 'source.widget',
  email: 'source.email',
  import: 'source.import',
};

export function sourceLabel(t: TFunction, source: string): string {
  const key = SOURCE_I18N[source];
  return key ? t(key) : source;
}

function localeOf(lang: string): string {
  return lang.startsWith('zh') ? 'zh-CN' : 'en-US';
}

export function formatDate(iso: string, lang: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(localeOf(lang), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateTime(iso: string, lang: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(localeOf(lang), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNumber(value: number, lang: string): string {
  return value.toLocaleString(localeOf(lang));
}

export function timeAgo(t: TFunction, iso: string, lang: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSeconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSeconds < 60) return t('time.justNow');
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return t('time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t('time.daysAgo', { count: days });
  return formatDate(iso, lang);
}
