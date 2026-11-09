const DEFAULT_CATEGORIES: ProjectCategory[] = [
  { name: 'bug', color: '#EF4444', icon: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { name: 'feature', color: '#6366F1', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { name: 'performance', color: '#F59E0B', icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
  { name: 'ui', color: '#8B5CF6', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z' },
  { name: 'other', color: '#64748B', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
];

export interface ProjectCategory {
  name: string;
  color: string;
  icon?: string;
}

/** 与服务端 priority enum 保持一致。 */
export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';

export interface FeedbackPayload {
  title: string;
  content: string;
  category: string;
  /** 关闭 fields.priority 时不传，由服务端默认 medium。 */
  priority?: FeedbackPriority;
  contact?: string;
  attachment_ids?: string[];
  source: 'widget';
}

const DEFAULT_ICON = DEFAULT_CATEGORIES[0]!.icon;

/** 从 apiUrl 中提取公开接口的项目 slug（若调用方直接使用 /public/:slug 形态）。 */
export function extractProjectSlug(apiUrl: string): string | null {
  const match = apiUrl.match(/\/api\/v1\/public\/([^/?#]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function categoriesUrl(apiUrl: string, slug: string | null | undefined): string | null {
  const base = apiUrl.replace(/\/+$/, '');
  if (base.includes('/public/')) return `${base}/categories`;
  if (!slug) return null;
  return `${base}/public/${encodeURIComponent(slug)}/categories`;
}

export async function fetchProjectCategories(
  apiUrl: string,
  slug: string | null | undefined,
): Promise<ProjectCategory[]> {
  const url = categoriesUrl(apiUrl, slug);
  if (!url) return DEFAULT_CATEGORIES;
  try {
    const res = await fetch(url);
    if (!res.ok) return DEFAULT_CATEGORIES;
    const json = await res.json();
    if (json.code !== 0 || !Array.isArray(json.data) || json.data.length === 0) return DEFAULT_CATEGORIES;
    return (json.data as Array<{ name: string; color: string }>).map((category) => {
      const match = DEFAULT_CATEGORIES.find((item) => item.name === category.name);
      return { name: category.name, color: category.color, icon: match?.icon ?? DEFAULT_ICON };
    });
  } catch {
    return DEFAULT_CATEGORIES;
  }
}
