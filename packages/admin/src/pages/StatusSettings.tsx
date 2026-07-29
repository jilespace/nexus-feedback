import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';
import { useToast } from '@/components/Toast';
import type { StatusConfig } from '@/types';

export function StatusSettings() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#6B7280');
  const [formPosition, setFormPosition] = useState(0);
  const [formIsClosed, setFormIsClosed] = useState(false);

  const { data: statuses, isLoading } = useQuery({
    queryKey: ['statuses', projectId],
    queryFn: () => apiRequest<StatusConfig[]>(`/org/projects/${projectId}/statuses`),
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; color: string; position: number; is_closed: boolean }) =>
      apiRequest(`/org/projects/${projectId}/statuses`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statuses', projectId] });
      resetForm();
      toast.show('状态创建成功');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '创建失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/org/projects/${projectId}/statuses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statuses', projectId] });
      toast.show('状态已删除');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '删除失败', 'error'),
  });

  function resetForm() {
    setShowForm(false);
    setFormName('');
    setFormColor('#6B7280');
    setFormPosition(0);
    setFormIsClosed(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({ name: formName, color: formColor, position: formPosition, is_closed: formIsClosed });
  }

  if (!projectId) {
    return <p className="text-sm text-gray-500">请先选择一个项目</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">状态配置</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
        >
          添加状态
        </button>
      </div>
      {isLoading && <p className="text-sm text-gray-400">加载中...</p>}
      {statuses && statuses.length > 0 && (
        <div className="space-y-2">
          {statuses.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-surface-3 bg-surface-0 px-5 py-3 dark:border-gray-600 dark:bg-gray-800">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{s.name}</span>
              <span className="text-xs text-gray-400">位置: {s.position}</span>
              {s.is_closed && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">关闭态</span>}
              {!s.id.startsWith('default_') && (
                <button
                  onClick={() => deleteMutation.mutate(s.id)}
                  disabled={deleteMutation.isPending}
                  className="text-xs text-red-500 hover:underline disabled:opacity-50"
                >
                  删除
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-surface-3 bg-surface-0 p-5 space-y-4 dark:border-gray-600 dark:bg-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">添加状态</h3>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">名称</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="如: reviewing"
              className="w-full rounded-lg border border-surface-3 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
            />
          </div>
          <div className="flex gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">颜色</label>
              <input
                type="color"
                value={formColor}
                onChange={(e) => setFormColor(e.target.value)}
                className="h-9 w-16 cursor-pointer rounded border border-surface-3 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">位置</label>
              <input
                type="number"
                value={formPosition}
                onChange={(e) => setFormPosition(Number(e.target.value))}
                className="w-20 rounded-lg border border-surface-3 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={formIsClosed}
                  onChange={(e) => setFormIsClosed(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                关闭态
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              创建
            </button>
            <button type="button" onClick={resetForm} className="rounded-lg border border-surface-3 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-surface-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
              取消
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
