type ApiResponse<T> = {
  code: number;
  data: T;
  message: string;
};

const BASE_URL = '/api/v1';

function getToken(): string | null {
  return localStorage.getItem('admin_token');
}

export function setToken(token: string): void {
  localStorage.setItem('admin_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('admin_token');
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  if (!text) {
    throw new ApiError(50000, `服务器响应为空 (HTTP ${res.status})`, res.status);
  }

  let json: ApiResponse<T>;
  try {
    json = JSON.parse(text) as ApiResponse<T>;
  } catch {
    throw new ApiError(50000, `服务器响应格式错误: ${text.slice(0, 100)}`, res.status);
  }

  if (json.code !== 0) {
    throw new ApiError(json.code, json.message, res.status);
  }

  return json.data;
}

export async function assignFeedback(feedbackId: string, assigneeId: string | null) {
  return apiRequest<{ id: string; assignee_id: string | null }>(
    `/admin/feedback/${feedbackId}/assign`,
    {
      method: 'PATCH',
      body: JSON.stringify({ assignee_id: assigneeId }),
    },
  );
}

export async function fetchOrgMembers() {
  const result = await apiRequest<{ items: Array<{ id: string; display_name: string; email: string; role: string }> }>('/org/members');
  return result.items;
}

export async function fetchProjectCategories(): Promise<Array<{ name: string; color: string }>> {
  return apiRequest<Array<{ name: string; color: string }>>('/admin/categories');
}

export async function fetchAuditLogs(params: {
  page?: number;
  page_size?: number;
  action?: string;
  member_id?: string;
}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.page_size) query.set('page_size', String(params.page_size));
  if (params.action) query.set('action', params.action);
  if (params.member_id) query.set('member_id', String(params.member_id));
  const result = await apiRequest<{ items: Array<AuditLogResponse>; page: number; page_size: number; total: number }>(
    `/org/audit-logs?${query}`,
  );
  return result;
}

type AuditLogResponse = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  member_id: string | null;
  member?: { id: string; display_name: string } | null;
  created_at: string;
};

export class ApiError extends Error {
  constructor(
    public code: number,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
