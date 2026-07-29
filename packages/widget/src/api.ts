const DEFAULT_CATEGORIES = [
  { name: 'bug', color: '#ef4444', icon: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { name: 'feature', color: '#6366f1', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { name: 'performance', color: '#f59e0b', icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
  { name: 'ui', color: '#8b5cf6', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z' },
  { name: 'other', color: '#6b7280', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
];

export interface ProjectCategory {
  name: string;
  color: string;
  icon?: string;
}

export async function fetchProjectCategories(apiUrl: string, slug: string): Promise<ProjectCategory[]> {
  try {
    const res = await fetch(`${apiUrl}/api/v1/public/${slug}/categories`);
    if (!res.ok) return DEFAULT_CATEGORIES;
    const json = await res.json();
    if (json.code !== 0 || !json.data?.length) return DEFAULT_CATEGORIES;
    return json.data.map((c: { name: string; color: string }) => {
      const match = DEFAULT_CATEGORIES.find(d => d.name === c.name);
      return { name: c.name, color: c.color, icon: match?.icon ?? DEFAULT_CATEGORIES[0]!.icon };
    });
  } catch {
    return DEFAULT_CATEGORIES;
  }
}
