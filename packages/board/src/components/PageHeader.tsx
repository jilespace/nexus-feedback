import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
  size?: 'default' | 'hero';
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  action,
  size = 'default',
}: PageHeaderProps) {
  const titleClass =
    size === 'hero'
      ? 'text-28 font-semibold text-ink sm:text-34'
      : 'text-22 font-semibold text-ink sm:text-28';

  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className={titleClass}>{title}</h1>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-13 text-ink-secondary">{subtitle}</p>
        )}
      </div>
      {action}
    </header>
  );
}
