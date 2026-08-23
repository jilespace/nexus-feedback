import { useCallback, useState } from 'react';

export type SavedView = {
  name: string;
  filters: Record<string, string>;
};

const MAX_VIEWS = 10;

function storageKey(orgId: string): string {
  return `nexus-saved-views-${orgId}`;
}

function load(orgId: string): SavedView[] {
  try {
    const raw = localStorage.getItem(storageKey(orgId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useSavedViews(orgId: string | null | undefined) {
  const [views, setViews] = useState<SavedView[]>(() => (orgId ? load(orgId) : []));

  const persist = useCallback(
    (next: SavedView[]) => {
      setViews(next);
      if (orgId) localStorage.setItem(storageKey(orgId), JSON.stringify(next));
    },
    [orgId],
  );

  const save = useCallback(
    (name: string, filters: Record<string, string>): 'saved' | 'updated' | 'limit' => {
      if (!orgId) return 'limit';
      const trimmed = name.trim();
      if (!trimmed) return 'limit';
      const existing = load(orgId);
      const idx = existing.findIndex((v) => v.name === trimmed);
      if (idx >= 0) {
        existing[idx]!.filters = filters;
        persist(existing);
        return 'updated';
      }
      if (existing.length >= MAX_VIEWS) return 'limit';
      existing.push({ name: trimmed, filters });
      persist(existing);
      return 'saved';
    },
    [orgId, persist],
  );

  const remove = useCallback(
    (name: string) => {
      if (!orgId) return;
      persist(load(orgId).filter((v) => v.name !== name));
    },
    [orgId, persist],
  );

  return { views, save, remove };
}
