export type CategoryOption = {
  name: string;
  color: string;
  label: string;
  description: string;
  icon: string;
};

const CATEGORY_META: Record<string, { label: string; description: string; icon: string }> = {
  bug: {
    label: 'Bug 修复',
    description: '报错、崩溃或功能异常',
    icon: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  feature: {
    label: '功能建议',
    description: '希望新增的能力',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  performance: {
    label: '性能优化',
    description: '加载慢或卡顿',
    icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  },
  ui: {
    label: '界面体验',
    description: '布局、交互与视觉问题',
    icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z',
  },
  other: {
    label: '其他',
    description: '不属于以上分类的反馈',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

const DEFAULT_CATEGORIES = [
  { name: 'bug', color: '#EF4444' },
  { name: 'feature', color: '#6366F1' },
  { name: 'performance', color: '#F59E0B' },
  { name: 'ui', color: '#8B5CF6' },
  { name: 'other', color: '#64748B' },
] as const;

function toOption(name: string, color: string): CategoryOption {
  const meta = CATEGORY_META[name];
  return {
    name,
    color,
    label: meta?.label ?? name,
    description: meta?.description ?? '其他反馈',
    icon: meta?.icon ?? CATEGORY_META.other!.icon,
  };
}

export function buildCategoryOptions(
  remote: Array<{ name: string; color: string }>,
): CategoryOption[] {
  const source = remote.length > 0 ? remote : DEFAULT_CATEGORIES.map((c) => ({ name: c.name, color: c.color }));
  return source.map((category) => toOption(category.name, category.color));
}
