import type { FeedbackPriority, FeedbackSource, FeedbackStatus } from '@/types';

type Lang = 'zh' | 'en';

function langOf(language: string | undefined): Lang {
  return language?.startsWith('en') ? 'en' : 'zh';
}

const CATEGORY_LABELS: Record<string, { zh: string; en: string }> = {
  bug: { zh: 'Bug 修复', en: 'Bug' },
  feature: { zh: '功能建议', en: 'Feature' },
  performance: { zh: '性能优化', en: 'Performance' },
  ui: { zh: '界面体验', en: 'UI' },
  other: { zh: '其他', en: 'Other' },
};

const CATEGORY_COLORS: Record<string, string> = {
  bug: '#ef4444',
  feature: '#6366f1',
  performance: '#f59e0b',
  ui: '#8b5cf6',
  other: '#64748b',
};

const PALETTE = ['#6366f1', '#f59e0b', '#0ea5e9', '#10b981', '#8b5cf6', '#ec4899', '#64748b'];

export function categoryLabel(name: string, language?: string): string {
  const lang = langOf(language);
  return CATEGORY_LABELS[name]?.[lang] ?? name;
}

export function categoryColor(name: string): string {
  if (CATEGORY_COLORS[name]) return CATEGORY_COLORS[name];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
}

const PRIORITY_LABELS: Record<FeedbackPriority, { zh: string; en: string }> = {
  low: { zh: '低', en: 'Low' },
  medium: { zh: '中', en: 'Medium' },
  high: { zh: '高', en: 'High' },
  critical: { zh: '紧急', en: 'Critical' },
};

const PRIORITY_COLORS: Record<FeedbackPriority, string> = {
  low: '#94a3b8',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

export function priorityLabel(priority: FeedbackPriority, language?: string): string {
  return PRIORITY_LABELS[priority]?.[langOf(language)] ?? priority;
}

export function priorityColor(priority: FeedbackPriority): string {
  return PRIORITY_COLORS[priority] ?? '#94a3b8';
}

const STATUS_LABELS: Record<FeedbackStatus, { zh: string; en: string }> = {
  open: { zh: '待处理', en: 'Open' },
  in_progress: { zh: '处理中', en: 'In progress' },
  resolved: { zh: '已解决', en: 'Resolved' },
  closed: { zh: '已关闭', en: 'Closed' },
};

export type StatusTone = 'amber' | 'blue' | 'green' | 'gray';

export const STATUS_META: Record<
  FeedbackStatus,
  { label: { zh: string; en: string }; dot: string; tone: StatusTone }
> = {
  open: { label: STATUS_LABELS.open, dot: '#f59e0b', tone: 'amber' },
  in_progress: { label: STATUS_LABELS.in_progress, dot: '#0ea5e9', tone: 'blue' },
  resolved: { label: STATUS_LABELS.resolved, dot: '#10b981', tone: 'green' },
  closed: { label: STATUS_LABELS.closed, dot: '#94a3b8', tone: 'gray' },
};

export function statusLabel(status: FeedbackStatus, language?: string): string {
  return STATUS_LABELS[status]?.[langOf(language)] ?? status;
}

const SOURCE_LABELS: Record<FeedbackSource, { zh: string; en: string }> = {
  api: { zh: 'API', en: 'API' },
  widget: { zh: 'Widget', en: 'Widget' },
  'submit-page': { zh: '提交页', en: 'Submit page' },
  board: { zh: '看板', en: 'Board' },
};

export function sourceLabel(source: string | undefined, language?: string): string {
  if (!source) return '—';
  return SOURCE_LABELS[source as FeedbackSource]?.[langOf(language)] ?? source;
}

export const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS);
export const CATEGORY_PALETTE = PALETTE;
