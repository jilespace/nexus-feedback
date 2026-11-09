import { clsx } from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-surface-3 bg-surface-0 shadow-card',
        'dark:border-gray-700/80 dark:bg-gray-800',
        hover && 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

type BadgeTone = 'brand' | 'amber' | 'blue' | 'green' | 'gray' | 'red' | 'violet';

const BADGE_TONES: Record<BadgeTone, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-200/70 dark:bg-brand-600/15 dark:text-brand-300 dark:ring-brand-500/25',
  amber: 'bg-accent-50 text-accent-600 ring-accent-200/80 dark:bg-accent-500/15 dark:text-accent-300 dark:ring-accent-500/25',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200/80 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/25',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25',
  gray: 'bg-surface-2 text-gray-600 ring-surface-3 dark:bg-gray-700/60 dark:text-gray-300 dark:ring-gray-600/60',
  red: 'bg-rose-50 text-rose-700 ring-rose-200/80 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/25',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200/80 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/25',
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

export function Badge({ children, tone = 'gray', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

type StatTone = 'neutral' | 'amber' | 'blue' | 'green' | 'violet' | 'gray' | 'brand';

const STAT_TONES: Record<StatTone, { icon: string; bar: string }> = {
  neutral: {
    icon: 'bg-surface-2 text-gray-600 dark:bg-gray-700/70 dark:text-gray-300',
    bar: 'bg-gray-400 dark:bg-gray-500',
  },
  brand: {
    icon: 'bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300',
    bar: 'bg-brand-500',
  },
  amber: {
    icon: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
    bar: 'bg-accent-500',
  },
  blue: {
    icon: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
    bar: 'bg-sky-500',
  },
  green: {
    icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  },
  violet: {
    icon: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
    bar: 'bg-violet-500',
  },
  gray: {
    icon: 'bg-gray-100 text-gray-500 dark:bg-gray-700/70 dark:text-gray-400',
    bar: 'bg-gray-400 dark:bg-gray-500',
  },
};

interface StatCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone?: StatTone;
  hint?: string;
  className?: string;
}

export function StatCard({ label, value, icon, tone = 'neutral', hint, className }: StatCardProps) {
  const t = STAT_TONES[tone];
  return (
    <div
      className={clsx(
        'group relative overflow-hidden rounded-xl border border-surface-3 bg-surface-0 p-4 shadow-card transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-card-hover dark:border-gray-700/80 dark:bg-gray-800',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold leading-none tracking-tight tabular-nums text-gray-900 dark:text-gray-50">
            {value}
          </p>
          {hint && (
            <p className="mt-2 truncate text-[11px] text-gray-400 dark:text-gray-500">{hint}</p>
          )}
        </div>
        <span
          className={clsx(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            t.icon,
          )}
        >
          {icon}
        </span>
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

export function ProgressBar({
  value,
  max,
  color = 'bg-brand-500',
  className,
  showLabel,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2 dark:bg-gray-700">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="w-8 text-right text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">
          {value}
        </span>
      )}
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'flex animate-fade-up flex-col items-center justify-center px-6 py-14 text-center',
        className,
      )}
    >
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-surface-3 bg-surface-1 text-gray-400 dark:border-gray-700/70 dark:bg-gray-700/40 dark:text-gray-500">
          {icon}
        </div>
      )}
      <p className="mt-4 text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-gray-400 dark:text-gray-500">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-5" size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={clsx('skeleton', className)} />;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300 dark:disabled:bg-brand-900/60',
  secondary:
    'border border-surface-3 bg-surface-0 text-gray-700 shadow-sm hover:border-gray-300 hover:bg-surface-1 active:bg-surface-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-700/70',
  ghost:
    'text-gray-600 hover:bg-surface-2 hover:text-gray-900 active:bg-surface-3 dark:text-gray-300 dark:hover:bg-gray-700/70 dark:hover:text-gray-100',
  danger:
    'bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-300',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-xs',
  md: 'h-9 gap-2 rounded-lg px-4 text-sm',
  lg: 'h-10 gap-2 rounded-lg px-5 text-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex select-none items-center justify-center font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 dark:focus-visible:ring-offset-gray-800',
        'disabled:cursor-not-allowed disabled:opacity-60',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-surface-3 bg-surface-1 px-1 font-sans text-[10px] font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-700/60 dark:text-gray-400">
      {children}
    </kbd>
  );
}
