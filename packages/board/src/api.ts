import type {
  ApiResponse,
  ChangelogEntry,
  Comment as FeedbackComment,
  FeedbackDetail,
  FeedbackItem,
  PaginatedResponse,
  RoadmapData,
} from './types';

function getSlug(): string {
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);
  return parts[0] || 'default';
}

function baseUrl(): string {
  return `/api/v1/public/${getSlug()}`;
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

export interface FeedbackListParams {
  sort_by?: 'votes' | 'created_at';
  status?: string;
  category?: string;
  keyword?: string;
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
  if (params.keyword) query.set('keyword', params.keyword);
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

export interface ProjectCategory {
  name: string;
  color: string;
}

export async function fetchProjectCategories(): Promise<ProjectCategory[]> {
  try {
    const res = await request<ProjectCategory[]>('/categories');
    return res;
  } catch {
    return [
      { name: 'feature', color: '#6366f1' },
      { name: 'bug', color: '#ef4444' },
      { name: 'improvement', color: '#f59e0b' },
      { name: 'other', color: '#6b7280' },
    ];
  }
}
