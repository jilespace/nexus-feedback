import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';
import type { SavedView } from '@/types';

export type { SavedView };

const MAX_VIEWS = 10;
const MAX_NAME_LENGTH = 50;

function storageKey(orgId: string): string {
  return `nexus-saved-views-${orgId}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Sanitises localStorage entries (legacy records have no created_at) before using them. */
function sanitizeViews(raw: unknown): SavedView[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const views: SavedView[] = [];
  for (const item of raw) {
    if (!isPlainObject(item) || typeof item.name !== 'string') continue;
    const name = item.name.trim().slice(0, MAX_NAME_LENGTH);
    if (!name || seen.has(name)) continue;
    if (!isPlainObject(item.filters)) continue;
    const filters: Record<string, string> = {};
    for (const [key, value] of Object.entries(item.filters)) {
      if (typeof value !== 'string') continue;
      filters[key] = value;
    }
    const createdAt =
      typeof item.created_at === 'string' && !Number.isNaN(new Date(item.created_at).getTime())
        ? item.created_at
        : new Date().toISOString();
    seen.add(name);
    views.push({ name, filters, created_at: createdAt });
    if (views.length >= MAX_VIEWS) break;
  }
  return views;
}

function loadLocal(orgId: string): SavedView[] {
  try {
    const raw = localStorage.getItem(storageKey(orgId));
    return raw ? sanitizeViews(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function writeLocal(orgId: string, views: SavedView[]): void {
  try {
    localStorage.setItem(storageKey(orgId), JSON.stringify(views));
  } catch {
    // Quota/permission errors must not break saving; the server remains the source of truth.
  }
}

/**
 * Saved filter presets for the feedback list.
 * Server-backed (cross-device) with localStorage as an offline cache: the server is read
 * through react-query, mutations are optimistic (rollback on failure) and every successful
 * read/write is mirrored to localStorage so an unavailable API still shows the last views.
 */
export function useSavedViews(orgId: string | null | undefined) {
  const queryClient = useQueryClient();
  const hasToken = typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('admin_token'));
  const enabled = Boolean(orgId && hasToken);
  const queryKey = ['saved-views', orgId ?? 'anonymous'] as const;

  const [localViews, setLocalViews] = useState<SavedView[]>(() => (orgId ? loadLocal(orgId) : []));
  const viewsRef = useRef<SavedView[]>(localViews);

  useEffect(() => {
    const next = orgId ? loadLocal(orgId) : [];
    viewsRef.current = next;
    setLocalViews(next);
  }, [orgId]);

  const { data: serverViews, isSuccess } = useQuery({
    queryKey,
    queryFn: () => apiRequest<SavedView[]>('/org/member/saved-views'),
    enabled,
    retry: 1,
  });

  useEffect(() => {
    if (!serverViews) return;
    viewsRef.current = serverViews;
    setLocalViews(serverViews);
    if (orgId) writeLocal(orgId, serverViews);
  }, [serverViews, orgId]);

  const sync = useMutation<SavedView[], Error, SavedView[], SavedView[]>({
    mutationFn: (views) =>
      apiRequest<SavedView[]>('/org/member/saved-views', {
        method: 'PUT',
        body: JSON.stringify({ views }),
      }),
    onMutate: async (views) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SavedView[]>(queryKey) ?? viewsRef.current;
      queryClient.setQueryData<SavedView[]>(queryKey, views);
      viewsRef.current = views;
      setLocalViews(views);
      if (orgId) writeLocal(orgId, views);
      return previous;
    },
    onSuccess: (views) => {
      queryClient.setQueryData<SavedView[]>(queryKey, views);
      viewsRef.current = views;
      setLocalViews(views);
      if (orgId) writeLocal(orgId, views);
    },
    onError: (_error, _views, previous) => {
      if (!previous) return;
      queryClient.setQueryData<SavedView[]>(queryKey, previous);
      viewsRef.current = previous;
      setLocalViews(previous);
      if (orgId) writeLocal(orgId, previous);
    },
  });

  // One-shot compatibility migration: legacy localStorage-only views are pushed to an empty
  // server list so existing users keep their presets after the upgrade.
  const migratedRef = useRef(false);
  useEffect(() => {
    if (!enabled || !isSuccess || migratedRef.current || !orgId) return;
    migratedRef.current = true;
    const stored = loadLocal(orgId);
    if ((serverViews?.length ?? 0) === 0 && stored.length > 0) {
      sync.mutate(stored);
    }
  }, [enabled, isSuccess, orgId, serverViews, sync]);

  const persistLocally = useCallback(
    (next: SavedView[]) => {
      viewsRef.current = next;
      setLocalViews(next);
      if (orgId) writeLocal(orgId, next);
    },
    [orgId],
  );

  const save = useCallback(
    (name: string, filters: Record<string, string>): 'saved' | 'updated' | 'limit' => {
      if (!orgId) return 'limit';
      const trimmed = name.trim();
      if (!trimmed) return 'limit';
      if (trimmed.length > MAX_NAME_LENGTH) return 'limit';
      const current = viewsRef.current;
      const index = current.findIndex((view) => view.name === trimmed);
      let next: SavedView[];
      let result: 'saved' | 'updated';
      if (index >= 0) {
        next = current.map((view, i) => (i === index ? { ...view, filters } : view));
        result = 'updated';
      } else {
        if (current.length >= MAX_VIEWS) return 'limit';
        next = [...current, { name: trimmed, filters, created_at: new Date().toISOString() }];
        result = 'saved';
      }
      if (enabled) sync.mutate(next);
      else persistLocally(next);
      return result;
    },
    [enabled, orgId, persistLocally, sync],
  );

  const remove = useCallback(
    (name: string) => {
      if (!orgId) return;
      const current = viewsRef.current;
      if (!current.some((view) => view.name === name)) return;
      const next = current.filter((view) => view.name !== name);
      if (enabled) sync.mutate(next);
      else persistLocally(next);
    },
    [enabled, orgId, persistLocally, sync],
  );

  const views = enabled ? (serverViews ?? localViews) : localViews;

  return { views, save, remove };
}
