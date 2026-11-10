import type {
  ApiResponse,
  BoardConfig,
  ChangelogEntry,
  Comment as FeedbackComment,
  FeedbackDetail,
  FeedbackItem,
  PaginatedResponse,
  ProjectCategory,
  RoadmapData,
  SubscribeResult,
  SubscribeType,
} from './types';

export function getProjectSlug(): string {
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);
  return parts[0] || 'default';
}

function baseUrl(): string {
  return `/api/v1/public/${getProjectSlug()}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`请求失败: ${res.status}`);
  }
  const json = (await res.json()) as ApiResponse<T>;
  if (json.code !== 0) {
    throw new Error(json.message || '未知错误');
  }
  return json.data;
}

/** Request an endpoint that is not scoped under /public/:projectSlug. */
async function requestAbsolute<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`请求失败: ${res.status}`);
  }
  const json = (await res.json()) as ApiResponse<T>;
  if (json.code !== 0) {
    throw new Error(json.message || '未知错误');
  }
  return json.data;
}

export interface FeedbackListParams {
  sort_by?: 'votes' | 'created_at';
  status?: string;
  category?: string;
  page?: number;
  page_size?: number;
}

export function fetchFeedbackList(
  params: FeedbackListParams = {},
): Promise<PaginatedResponse<FeedbackItem>> {
  const query = new URLSearchParams();
  if (params.sort_by) query.set('sort_by', params.sort_by);
  if (params.status) query.set('status', params.status);
  if (params.category) query.set('category', params.category);
  if (params.page) query.set('page', String(params.page));
  if (params.page_size) query.set('page_size', String(params.page_size));
  const qs = query.toString();
  return request<PaginatedResponse<FeedbackItem>>(
    `/feedback${qs ? `?${qs}` : ''}`,
  );
}

export function fetchFeedbackDetail(id: string): Promise<FeedbackDetail> {
  return request<FeedbackDetail>(`/feedback/${id}`);
}

export function fetchBoardConfig(): Promise<BoardConfig> {
  return request<BoardConfig>('/config');
}

export function submitFeedback(body: {
  title: string;
  content: string;
  category: string;
  priority?: string;
  email?: string;
}): Promise<FeedbackItem> {
  return request<FeedbackItem>('/feedback', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function vote(feedbackId: string, email: string): Promise<void> {
  return request<void>(`/feedback/${feedbackId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function unvote(feedbackId: string, email: string): Promise<void> {
  return request<void>(`/feedback/${feedbackId}/vote`, {
    method: 'DELETE',
    body: JSON.stringify({ email }),
  });
}

export function postComment(
  feedbackId: string,
  body: { email: string; name?: string; content: string },
): Promise<FeedbackComment> {
  return request<FeedbackComment>(`/feedback/${feedbackId}/comments`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchRoadmap(): Promise<RoadmapData> {
  return request<RoadmapData>('/roadmap');
}

export function fetchChangelog(): Promise<ChangelogEntry[]> {
  return request<ChangelogEntry[]>('/changelog');
}

export function subscribeToUpdates(body: {
  email: string;
  type: SubscribeType;
}): Promise<SubscribeResult> {
  return request<SubscribeResult>('/subscribe', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function unsubscribeFromUpdates(body: {
  email: string;
  project_id: string;
  type: 'all';
}): Promise<{ unsubscribed: boolean }> {
  return requestAbsolute<{ unsubscribed: boolean }>(
    '/api/v1/public/unsubscribe',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

/**
 * Resolve the project id needed by the public unsubscribe endpoint.
 *
 * The public board config only exposes the project name/slug today, so this
 * falls back to the changelog payload (which still carries `project_id`) until
 * the config endpoint exposes `project.id`. Returns null when neither source
 * is available, in which case the card keeps the local subscription state.
 */
export async function resolveProjectIdForUnsubscribe(): Promise<string | null> {
  try {
    const config = await fetchBoardConfig();
    const id = config.project?.id;
    if (typeof id === 'string' && id) return id;
  } catch {
    /* fall back to the changelog payload */
  }
  try {
    const entries = await fetchChangelog();
    const id = entries.find(
      (entry) => typeof entry.project_id === 'string' && entry.project_id,
    )?.project_id;
    return typeof id === 'string' && id ? id : null;
  } catch {
    return null;
  }
}

export async function fetchProjectCategories(): Promise<ProjectCategory[]> {
  try {
    return await request<ProjectCategory[]>('/categories');
  } catch {
    return [
      { name: 'bug', color: '#6366f1' },
      { name: 'feature', color: '#f59e0b' },
      { name: 'performance', color: '#0ea5e9' },
      { name: 'ui', color: '#10b981' },
      { name: 'other', color: '#64748b' },
    ];
  }
}
