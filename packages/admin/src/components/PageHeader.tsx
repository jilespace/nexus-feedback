import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { ChevronLeftIcon } from '@/components/icons';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  backTo?: { label: string; onClick: () => void };
  eyebrow?: string;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  backTo,
  eyebrow,
  className,
}: PageHeaderProps) {
  return (
    <div className={clsx('animate-fade-in', className)}>
      {backTo && (
        <button
          onClick={backTo.onClick}
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ChevronLeftIcon />
          {backTo.label}
        </button>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-brand-600 dark:text-brand-400">
              {eyebrow}
            </p>
          )}
          <h1 className="truncate text-[22px] font-semibold leading-tight text-gray-900 dark:text-gray-50">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
