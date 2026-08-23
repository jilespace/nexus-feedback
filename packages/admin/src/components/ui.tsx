import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover }: CardProps) {
  return (
    <div className={clsx(
      'rounded-xl border border-surface-3 bg-surface-0 dark:border-gray-700 dark:bg-gray-800',
      hover && 'transition-shadow hover:shadow-md',
      className,
    )}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, action, className }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-center justify-between', className)}>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {action}
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  className?: string;
}

export function Badge({ children, className }: BadgeProps) {
  return (
    <span className={clsx('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', className)}>
      {children}
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  accent: string;
}

export function StatCard({ label, value, icon, accent }: StatCardProps) {
  return (
    <div className={clsx('group relative overflow-hidden rounded-xl border border-surface-3 p-4 transition-all hover:shadow-lg hover:-translate-y-0.5', accent)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="mt-1 text-xs font-medium opacity-70">{label}</p>
        </div>
        {icon}
      </div>
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({ value, max, color = 'bg-brand-500', className, showLabel }: ProgressBarProps) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <div className="flex-1 h-2 overflow-hidden rounded-full bg-surface-2 dark:bg-gray-700">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="w-8 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{value}</span>
      )}
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
      {icon && (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 dark:bg-gray-700">
          {icon}
        </div>
      )}
      <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-300">{title}</p>
      {description && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-800"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={clsx('animate-pulse rounded bg-surface-2 dark:bg-gray-700', className)} />
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
