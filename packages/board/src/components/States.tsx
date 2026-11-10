import type { ReactNode } from 'react';
import { AlertIcon, InboxIcon } from './Icons';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`card flex flex-col items-center px-6 py-14 text-center ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line-subtle bg-surface-subtle text-ink-tertiary">
        {icon ?? <InboxIcon className="h-5 w-5" />}
      </div>
      <h3 className="mt-4 text-14 font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-13 text-ink-secondary">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title: string;
  description?: string;
  retryLabel: string;
  onRetry: () => void;
  className?: string;
}

export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`card flex flex-col items-center px-6 py-14 text-center ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-danger/20 bg-danger/10 text-danger">
        <AlertIcon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-14 font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-13 text-ink-secondary">{description}</p>
      )}
      <button type="button" onClick={onRetry} className="btn-secondary mt-5">
        {retryLabel}
      </button>
    </div>
  );
}

export function FeedbackListSkeleton({
  label,
  count = 4,
}: {
  label: string;
  count?: number;
}) {
  return (
    <div className="space-y-3" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card flex gap-3.5 p-4">
          <div className="skeleton h-[60px] w-[52px] shrink-0 rounded-pill" />
          <div className="min-w-0 flex-1 space-y-2.5 py-1">
            <div className="skeleton h-3.5 w-3/5" />
            <div className="skeleton h-3 w-4/5" />
            <div className="skeleton h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RoadmapSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 md:pb-0">
        {Array.from({ length: 3 }).map((_, column) => (
          <div
            key={column}
            className="w-[85vw] max-w-[320px] shrink-0 snap-start rounded-card border border-line-subtle bg-surface-subtle/60 md:w-auto md:max-w-none"
          >
            <div className="flex items-center justify-between border-b border-line-subtle px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <div className="skeleton h-2 w-2 rounded-full" />
                <div className="skeleton h-3.5 w-20" />
              </div>
              <div className="skeleton h-5 w-8 rounded-pill" />
            </div>
            <div className="space-y-2.5 p-2.5">
              {Array.from({ length: 9 }).map((__, card) => (
                <div
                  key={card}
                  className="rounded-control border border-line-subtle bg-surface p-3.5"
                >
                  <div className="skeleton h-3.5 w-5/6" />
                  <div className="skeleton mt-3 h-3 w-24" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChangelogSkeleton({ label }: { label: string }) {
  const lineWidths = [
    'w-full',
    'w-11/12',
    'w-5/6',
    'w-full',
    'w-3/4',
    'w-11/12',
    'w-2/3',
    'w-1/2',
  ];
  return (
    <div role="status" aria-busy="true" aria-label={label} className="relative">
      <span
        className="absolute bottom-2 left-[5px] top-2 w-px bg-line-subtle md:left-[148px]"
        aria-hidden="true"
      />
      <div className="space-y-6 md:space-y-10">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="relative pl-6 md:grid md:grid-cols-[132px_1fr] md:gap-8 md:pl-0"
          >
            <span
              className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-brand bg-surface md:left-[143px] md:top-[9px]"
              aria-hidden="true"
            />
            <div className="skeleton h-3 w-24 md:mt-1.5 md:justify-self-end" />
            <div className="card mt-2 p-4 sm:p-5 md:mt-0">
              <div className="skeleton h-4 w-2/5" />
              <div className="mt-3 space-y-2">
                {lineWidths.map((width, line) => (
                  <div key={line} className={`skeleton h-3 ${width}`} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label={label}>
      <div className="skeleton h-3 w-28" />
      <div className="card p-4 sm:p-6">
        <div className="flex gap-4">
          <div className="skeleton h-[60px] w-[52px] shrink-0 rounded-pill" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="skeleton h-[22px] w-16 rounded-pill" />
              <div className="skeleton h-[22px] w-20 rounded-pill" />
            </div>
            <div className="skeleton h-5 w-3/5" />
            <div className="skeleton h-3 w-2/5" />
            <div className="skeleton h-[22px] w-24 rounded-pill" />
          </div>
        </div>
        <div className="mt-5 space-y-2.5 border-t border-line-subtle pt-4">
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-11/12" />
          <div className="skeleton h-3 w-2/3" />
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-1 space-y-3">
        <div className="skeleton h-3.5 w-24" />
        <div className="rounded-card border border-dashed border-line-strong/50 px-4 py-8">
          <div className="skeleton mx-auto h-3 w-48" />
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2.5">
            <div className="skeleton h-8 w-8 rounded-full" />
            <div className="space-y-1.5">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-2.5 w-16" />
            </div>
          </div>
          <div className="skeleton mt-2.5 h-3 w-full" />
          <div className="skeleton mt-2 h-3 w-3/5" />
        </div>
      </div>
      <div className="card mt-1 p-4 sm:p-5">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton mt-2 h-3 w-64 max-w-full" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="skeleton h-10" />
          <div className="skeleton h-10" />
        </div>
        <div className="skeleton mt-3 h-24" />
        <div className="mt-4 flex justify-end">
          <div className="skeleton h-9 w-24 rounded-control" />
        </div>
      </div>
    </div>
  );
}

export function SidebarStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index}>
          <div className="skeleton h-[22px] w-12" />
          <div className="skeleton mt-1.5 h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
