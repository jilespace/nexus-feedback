import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, fetchOrgTags, type OrgTagItem } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { Skeleton } from '@/components/Skeleton';

const DEFAULT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

const PRESETS = [
  { name: 'Bug', color: '#ef4444' },
  { name: '紧急', color: '#f97316' },
  { name: '待讨论', color: '#eab308' },
  { name: '客户反馈', color: '#8b5cf6' },
];

export function Tags() {
  const { member } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#ef4444');

  const { data: tags, isLoading } = useQuery({
    queryKey: ['org-tags'],
    queryFn: fetchOrgTags,
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

  const handleDelete = (tag: OrgTagItem) => {
    const usage = tag.usage_count ?? 0;
    const confirmed = usage > 0
      ? window.confirm(`该标签已被 ${usage} 条反馈使用，删除后将同时解除关联，确定？`)
      : window.confirm(`确定删除标签「${tag.name}」？`);
    if (confirmed) deleteMutation.mutate(tag.id);
  };

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
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">标签管理</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          标签用于给反馈打分类标记，可在反馈列表按标签筛选，帮助团队归类与追踪问题。
        </p>
      </div>
      {canManage && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">常用预设：</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => { setName(preset.name); setColor(preset.color); }}
                className="inline-flex items-center gap-1.5 rounded-full border border-surface-3 bg-surface-0 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-surface-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: preset.color }} />
                {preset.name}
              </button>
            ))}
          </div>
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
        </>
      )}
      <div className="rounded-xl border border-surface-3 bg-surface-0 shadow-sm dark:border-gray-600 dark:bg-gray-800">
        {tags && tags.length > 0 ? (
          <div className="divide-y divide-surface-3 dark:divide-gray-600">
            {tags.map((tag) => {
              const usage = tag.usage_count ?? 0;
              return (
                <div key={tag.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color ?? '#6b7280' }} />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{tag.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {usage > 0 ? `• ${usage} 条反馈` : '• 未使用'}
                    </span>
                  </div>
                  {canManage && (
                    <button onClick={() => handleDelete(tag)} disabled={deleteMutation.isPending} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">
                      删除
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            还没有标签，从上方常用预设快速创建，或自定义一个
          </p>
        )}
      </div>
    </div>
  );
}
