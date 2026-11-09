export type ProjectIdentity = {
  id: string;
  name: string;
  slug: string;
};

export type FeedbackDraft = {
  title: string;
  content: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  contact?: string;
  attachment_ids?: string[];
};

export type SubmitResult = {
  id: string;
  title: string;
  status: string;
};

type Envelope<T> = {
  code: number;
  data: T;
  message?: string;
};

const NETWORK_ERROR = '网络连接失败，请检查网络后重试';
const GENERIC_ERROR = '请求失败，请稍后重试';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: number;
  readonly retryable: boolean;

  constructor(message: string, options: { status?: number; code?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status ?? 0;
    this.code = options.code;
    this.retryable = options.retryable ?? false;
  }
}

async function readEnvelope<T>(res: Response): Promise<Envelope<T>> {
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  const envelope = (payload ?? {}) as Partial<Envelope<T>>;
  const message =
    typeof envelope.message === 'string' && envelope.message.trim() ? envelope.message : GENERIC_ERROR;

  if (!res.ok || envelope.code !== 0) {
    const retryable = res.status === 429 || res.status >= 500;
    throw new ApiError(message, { status: res.status, code: envelope.code, retryable });
  }

  return envelope as Envelope<T>;
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(NETWORK_ERROR, { retryable: true });
  }
  const envelope = await readEnvelope<T>(res);
  return envelope.data;
}

function authHeaders(apiKey: string): Record<string, string> {
  return { 'X-API-Key': apiKey };
}

export function validateAccess(apiUrl: string, apiKey: string, signal?: AbortSignal): Promise<ProjectIdentity> {
  return request<{ project: ProjectIdentity }>(`${apiUrl}/feedback/access`, {
    headers: authHeaders(apiKey),
    signal,
  }).then((data) => data.project);
}

export async function fetchCategories(
  apiUrl: string,
  projectSlug: string,
  signal?: AbortSignal,
): Promise<Array<{ name: string; color: string }>> {
  try {
    return await request<Array<{ name: string; color: string }>>(
      `${apiUrl}/public/${encodeURIComponent(projectSlug)}/categories`,
      { signal },
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return [];
  }
}

export async function uploadAttachment(
  apiUrl: string,
  apiKey: string,
  file: File,
  signal?: AbortSignal,
): Promise<{ id: string }> {
  const formData = new FormData();
  formData.append('file', file);
  return request<{ id: string }>(`${apiUrl}/upload`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: formData,
    signal,
  });
}

export function createFeedback(apiUrl: string, apiKey: string, draft: FeedbackDraft): Promise<SubmitResult> {
  return request<SubmitResult>(`${apiUrl}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(apiKey) },
    body: JSON.stringify({ ...draft, source: 'submit-page' }),
  });
}

/**
 * 公开看板的地址无法从提交页推断（本地开发时两端分属 8081 / 8082）。
 * 优先读取 VITE_BOARD_URL，其次开发环境回退到 8082，生产环境与提交页同源。
 */
export function resolveBoardUrl(projectSlug: string): string {
  const configured = (import.meta.env.VITE_BOARD_URL as string | undefined)?.replace(/\/+$/, '');
  const base = configured || (import.meta.env.DEV ? 'http://localhost:8082' : window.location.origin);
  return `${base}/${projectSlug}`;
}
