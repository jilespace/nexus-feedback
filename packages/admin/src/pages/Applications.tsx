import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiRequest } from '@/api/client';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import type { ProjectAccessInfo } from '@/types';

type RegeneratedKey = {
  id: string;
  api_key: string;
  api_key_prefix: string;
};

type NewProject = {
  id: string;
  name: string;
  slug: string;
  api_key: string;
  api_key_prefix: string;
  allowed_origins: string[];
  created_at: string;
};

function getBoardUrl(slug: string, boardUrl?: string | null): string {
  if (boardUrl) return `${boardUrl.replace(/\/$/, '')}/${slug}`;
  const origin = window.location.origin;
  return `${origin}/${slug}`;
}

function formatOrigins(origins: string[]): string {
  return origins.length > 0 ? origins.join(', ') : '未限制';
}

export function Applications() {
  const queryClient = useQueryClient();
  const { show: toast } = useToast();
  const [regeneratedKey, setRegeneratedKey] = useState<RegeneratedKey | null>(null);
  const [confirmProjectId, setConfirmProjectId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectKey, setNewProjectKey] = useState<NewProject | null>(null);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiRequest<ProjectAccessInfo[]>('/org/projects'),
  });

  const { data: orgBoardUrl } = useQuery({
    queryKey: ['org-board-url'],
    queryFn: () => apiRequest<{ board_url: string | null }>('/org/settings'),
    select: (data) => data.board_url,
  });

  const regenerateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<RegeneratedKey>(`/org/projects/${id}/regenerate-key`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      setRegeneratedKey(data);
      setConfirmProjectId(null);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast('Project API Key 已重新生成', 'success');
    },
    onError: (err: Error) => {
      setConfirmProjectId(null);
      toast(err.message || '重新生成失败', 'error');
    },
  });

  const createMutation = useMutation({
    mutationFn: (input: { name: string; slug?: string }) =>
      apiRequest<NewProject>('/org/projects', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      setNewProjectKey(data);
      setShowCreateModal(false);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast('项目创建成功', 'success');
    },
    onError: (err: Error) => {
      toast(err.message || '创建失败', 'error');
    },
  });

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast(`${label} 已复制`, 'success');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">项目接入</h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            每个项目使用自己的 Project API Key 接收反馈，公开看板和 Widget 共用同一份项目数据。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          新建项目
        </button>
      </div>

      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={(input) => createMutation.mutate(input)}
          isPending={createMutation.isPending}
        />
      )}

      {newProjectKey && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                项目创建成功 — 请保存以下 API Key（仅显示一次）
              </p>
              <code className="mt-2 block overflow-x-auto rounded-lg bg-white px-3 py-2 text-xs text-green-900 dark:bg-gray-900 dark:text-green-100">
                {newProjectKey.api_key}
              </code>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => handleCopy(newProjectKey.api_key, 'API Key')}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
              >
                复制
              </button>
              <button
                type="button"
                onClick={() => setNewProjectKey(null)}
                className="rounded-lg px-3 py-1.5 text-xs text-green-700 hover:bg-green-100 dark:text-green-200 dark:hover:bg-green-900/40"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {regeneratedKey && (
        <ApiKeyBanner
          apiKey={regeneratedKey.api_key}
          onCopy={(text) => handleCopy(text, 'API Key')}
          onDismiss={() => setRegeneratedKey(null)}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" variant="rectangular" />
          ))}
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-surface-3 bg-surface-0 dark:border-gray-700 dark:bg-gray-800">
          <table className="min-w-full divide-y divide-surface-3 text-left text-sm dark:divide-gray-700">
            <thead className="bg-surface-1 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">项目</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Project API Key</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Allowed origins</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">反馈</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-3 dark:divide-gray-700">
              {projects.map((project) => {
                const boardUrl = getBoardUrl(project.slug, orgBoardUrl);
                const isConfirming = confirmProjectId === project.id;
                return (
                  <tr key={project.id} className="transition-colors hover:bg-brand-50/40 dark:hover:bg-gray-700">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{project.name}</div>
                      <button
                        type="button"
                        onClick={() => handleCopy(boardUrl, '公开看板地址')}
                        className="mt-1 font-mono text-xs text-brand-600 hover:text-brand-700"
                      >
                        {boardUrl}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-surface-2 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        {project.api_key_prefix ? `${project.api_key_prefix}...` : '未生成'}
                      </code>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                      <span className="line-clamp-2">{formatOrigins(project.allowed_origins)}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {project.feedback_count ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link className="text-xs text-brand-600 hover:text-brand-700" to={`/projects/${project.id}/widget`}>
                          Widget
                        </Link>
                        <Link className="text-xs text-brand-600 hover:text-brand-700" to={`/projects/${project.id}/webhooks`}>
                          Webhook
                        </Link>
                        <Link className="text-xs text-brand-600 hover:text-brand-700" to={`/projects/${project.id}/statuses`}>
                          状态
                        </Link>
                        <Link className="text-xs text-brand-600 hover:text-brand-700" to={`/projects/${project.id}/settings`}>
                          设置
                        </Link>
                        {isConfirming ? (
                          <>
                            <button
                              type="button"
                              onClick={() => regenerateMutation.mutate(project.id)}
                              disabled={regenerateMutation.isPending}
                              className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
                            >
                              确认重置
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmProjectId(null)}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmProjectId(project.id)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            重置 Key
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function ApiKeyBanner({
  apiKey,
  onCopy,
  onDismiss,
}: {
  apiKey: string;
  onCopy: (text: string) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Project API Key（仅显示一次）</p>
          <code className="mt-2 block overflow-x-auto rounded-lg bg-white px-3 py-2 text-xs text-amber-900 dark:bg-gray-900 dark:text-amber-100">
            {apiKey}
          </code>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => onCopy(apiKey)}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
          >
            复制
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-surface-3 bg-surface-0 p-10 text-center dark:border-gray-700 dark:bg-gray-800">
      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">暂无项目</p>
      <p className="mt-1 text-xs text-gray-400">注册组织时会自动创建默认项目。</p>
    </div>
  );
}

function CreateProjectModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (input: { name: string; slug?: string }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), slug: slug.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">新建项目</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          创建后将自动生成 Project API Key。
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              项目名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：移动端 App"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              项目标识 (slug)
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="留空则根据名称自动生成"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {isPending ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
