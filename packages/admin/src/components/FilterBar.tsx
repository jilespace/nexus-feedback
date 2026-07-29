import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { fetchProjectCategories } from '@/api/client';

type FilterBarProps = {
  filters: Record<string, string>;
  onChange: (filters: Record<string, string>) => void;
};

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'open', label: '待处理' },
  { value: 'in_progress', label: '进行中' },
  { value: 'resolved', label: '已解决' },
  { value: 'closed', label: '已关闭' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: '全部优先级' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '紧急' },
];

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const [categories, setCategories] = useState<Array<{ name: string; color: string }>>([]);

  useEffect(() => {
    fetchProjectCategories().then(setCategories);
  }, []);

  const update = (key: string, value: string) => {
    const next = { ...filters };
    if (value) {
      next[key] = value;
    } else {
      delete next[key];
    }
    onChange(next);
  };

  const hasFilters = Object.keys(filters).length > 0;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        options={STATUS_OPTIONS}
        value={filters.status ?? ''}
        onChange={(v) => update('status', v)}
        active={!!filters.status}
      />
      <Select
        options={[
          { value: '', label: '全部分类' },
          ...categories.map((c) => ({ value: c.name, label: c.name })),
        ]}
        value={filters.category ?? ''}
        onChange={(v) => update('category', v)}
        active={!!filters.category}
      />
      <Select
        options={PRIORITY_OPTIONS}
        value={filters.priority ?? ''}
        onChange={(v) => update('priority', v)}
        active={!!filters.priority}
      />
      {hasFilters && (
        <button
          onClick={() => onChange({})}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <span className="text-xs">✕</span>
          重置筛选
        </button>
      )}
    </div>
  );
}

function Select({
  options,
  value,
  onChange,
  active,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  active: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={clsx(
        'appearance-none rounded-lg border bg-surface-0 py-1.5 pl-3 pr-8 text-sm font-medium transition-all',
        'bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2020%2020%27%20fill%3D%27%236b7280%27%3E%3Cpath%20fill-rule%3D%27evenodd%27%20d%3D%27M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%20010.02-1.06z%27%20clip-rule%3D%27evenodd%27/%3E%3C/svg%3E")] bg-[length:1.25rem] bg-[right_0.375rem_center] bg-no-repeat',
        'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100',
        active
          ? 'border-brand-300 bg-brand-50 text-brand-700'
          : 'border-surface-3 text-gray-700',
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
