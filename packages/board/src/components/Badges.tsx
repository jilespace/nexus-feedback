import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { FeedbackTag } from '../types';
import {
  categoryColor,
  categoryLabel,
  STATUS_BADGE_CLASS,
  STATUS_DOT_CLASS,
  statusLabel,
  statusTone,
} from '../lib/labels';

interface PillProps {
  className?: string;
}

export function CategoryPill({
  category,
  className = '',
}: PillProps & { category: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md border border-line-subtle bg-surface-subtle px-2 py-[3px] text-11 font-medium text-ink-secondary ${className}`}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: categoryColor(category) }}
        aria-hidden="true"
      />
      <span className="truncate">{categoryLabel(t, category)}</span>
    </span>
  );
}

export function StatusBadge({
  status,
  className = '',
}: PillProps & { status: string }) {
  const { t } = useTranslation();
  const tone = statusTone(status);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill px-2 py-[3px] text-11 font-medium ring-1 ring-inset ${STATUS_BADGE_CLASS[tone]} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[tone]}`}
        aria-hidden="true"
      />
      {statusLabel(t, status)}
    </span>
  );
}

export function TagPill({ tag, className = '' }: PillProps & { tag: FeedbackTag }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md border border-line-subtle bg-surface px-2 py-[3px] text-11 text-ink-tertiary ${className}`}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: tag.color }}
        aria-hidden="true"
      />
      <span className="truncate">{tag.name}</span>
    </span>
  );
}

export function CountBadge({ children }: { children: ReactNode }) {
  return (
    <span className="tnum inline-flex h-5 min-w-5 items-center justify-center rounded-pill border border-line-subtle bg-surface px-1.5 text-11 font-medium text-ink-secondary">
      {children}
    </span>
  );
}

export function MetaDot() {
  return (
    <span
      className="h-1 w-1 shrink-0 rounded-full bg-line-strong"
      aria-hidden="true"
    />
  );
}
