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
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: 3 }).map((_, column) => (
        <div
          key={column}
          className="rounded-card border border-line-subtle bg-surface-subtle/60 p-3"
        >
          <div className="flex items-center justify-between px-1 py-1">
            <div className="skeleton h-3.5 w-24" />
            <div className="skeleton h-5 w-8 rounded-pill" />
          </div>
          <div className="mt-3 space-y-2.5">
            {Array.from({ length: 3 }).map((__, card) => (
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
  );
}

export function ChangelogSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-8" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="md:grid md:grid-cols-[132px_1fr] md:gap-8">
          <div className="skeleton h-3 w-24" />
          <div className="card mt-2.5 p-5 md:mt-0">
            <div className="skeleton h-4 w-2/5" />
            <div className="skeleton mt-3 h-3 w-full" />
            <div className="skeleton mt-2 h-3 w-11/12" />
            <div className="skeleton mt-2 h-3 w-3/5" />
          </div>
        </div>
      ))}
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
            <div className="skeleton h-5 w-3/5" />
            <div className="skeleton h-3 w-2/5" />
          </div>
        </div>
        <div className="skeleton mt-6 h-3 w-full" />
        <div className="skeleton mt-2 h-3 w-11/12" />
        <div className="skeleton mt-2 h-3 w-2/3" />
      </div>
      <div className="card space-y-3 p-5">
        <div className="skeleton h-3.5 w-24" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-4/5" />
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
