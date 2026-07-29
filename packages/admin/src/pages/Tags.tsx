import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { Skeleton } from '@/components/Skeleton';
import type { Tag } from '@/types';

const DEFAULT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

export function Tags() {
  const { member } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#ef4444');

  const { data: tags, isLoading } = useQuery({
    queryKey: ['org-tags'],
    queryFn: () => apiRequest<Tag[]>('/org/tags'),
  });

  const createMutation = useMutation({
    mutationFn: (params: { name: string; color: string }) =>
      apiRequest('/org/tags', { method: 'POST', body: JSON.stringify(params) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-tags'] });
      toast.show('标签已创建');
      setName('');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '创建失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/org/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-tags'] });
      toast.show('标签已删除');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '删除失败', 'error'),
  });

  const canManage = member?.role === 'owner' || member?.role === 'admin';

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" variant="rectangular" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">标签管理</h1>
      {canManage && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) createMutation.mutate({ name: name.trim(), color }); }}
          className="flex items-end gap-3 rounded-xl border border-surface-3 bg-surface-0 p-4 dark:border-gray-600 dark:bg-gray-800"
        >
          <div className="flex-1 space-y-1.5">
            <label htmlFor="tag-name" className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">标签名称</label>
            <input id="tag-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="输入标签名" required className="block w-full rounded-xl border border-surface-3 bg-surface-1 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
          </div>
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">颜色</span>
            <div className="flex gap-1.5">
              {DEFAULT_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className={`h-7 w-7 rounded-full border-2 transition-all ${color === c ? 'border-gray-900 scale-110 dark:border-white' : 'border-transparent hover:scale-105'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <button type="submit" disabled={createMutation.isPending} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            创建标签
          </button>
        </form>
      )}
      <div className="rounded-xl border border-surface-3 bg-surface-0 shadow-sm dark:border-gray-600 dark:bg-gray-800">
        {tags && tags.length > 0 ? (
          <div className="divide-y divide-surface-3 dark:divide-gray-600">
            {tags.map((tag) => (
              <div key={tag.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color ?? '#6b7280' }} />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{tag.name}</span>
                </div>
                {canManage && (
                  <button onClick={() => deleteMutation.mutate(tag.id)} disabled={deleteMutation.isPending} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">
                    删除
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-gray-400">暂无标签</p>
        )}
      </div>
    </div>
  );
}
