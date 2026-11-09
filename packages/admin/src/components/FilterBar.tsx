import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { fetchProjectCategories } from '@/api/client';
import { categoryLabel } from '@/utils/labels';

type FilterBarProps = {
  filters: Record<string, string>;
  onChange: (filters: Record<string, string>) => void;
};

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const { t, i18n } = useTranslation();
  const { t: tf } = useTranslation('feedback');
  const [categories, setCategories] = useState<Array<{ name: string; color: string }>>([]);

  useEffect(() => {
    fetchProjectCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const update = (key: string, value: string) => {
    const next = { ...filters };
    if (value) next[key] = value;
    else delete next[key];
    onChange(next);
  };

  return (
    <>
      <Select
        label={tf('filters.status')}
        options={[
          { value: '', label: tf('filters.allStatus') },
          { value: 'open', label: t('feedback.status_open') },
          { value: 'in_progress', label: t('feedback.status_in_progress') },
          { value: 'resolved', label: t('feedback.status_resolved') },
          { value: 'closed', label: t('feedback.status_closed') },
        ]}
        value={filters.status ?? ''}
        onChange={(v) => update('status', v)}
        active={!!filters.status}
      />
      <Select
        label={tf('filters.category')}
        options={[
          { value: '', label: tf('filters.allCategory') },
          ...categories.map((c) => ({ value: c.name, label: categoryLabel(c.name, i18n.language) })),
        ]}
        value={filters.category ?? ''}
        onChange={(v) => update('category', v)}
        active={!!filters.category}
      />
      <Select
        label={tf('filters.priority')}
        options={[
          { value: '', label: tf('filters.allPriority') },
          { value: 'low', label: t('feedback.priority_low') },
          { value: 'medium', label: t('feedback.priority_medium') },
          { value: 'high', label: t('feedback.priority_high') },
          { value: 'critical', label: t('feedback.priority_critical') },
        ]}
        value={filters.priority ?? ''}
        onChange={(v) => update('priority', v)}
        active={!!filters.priority}
      />
    </>
  );
}

function Select({
  label,
  options,
  value,
  onChange,
  active,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  active: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={clsx(
        'h-9 appearance-none rounded-lg border py-0 pl-2.5 pr-7 text-[13px] font-medium transition-colors',
        "bg-[url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2020%2020%27%20fill%3D%27%236b7280%27%3E%3Cpath%20fill-rule%3D%27evenodd%27%20d%3D%27M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%20010.02-1.06z%27%20clip-rule%3D%27evenodd%27/%3E%3C/svg%3E\")] bg-[length:1.1rem] bg-[right_0.4rem_center] bg-no-repeat",
        'focus:outline-none focus:ring-2 focus:ring-brand-500/15',
        active
          ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-600/15 dark:text-brand-300'
          : 'border-surface-3 bg-surface-0 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600',
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
