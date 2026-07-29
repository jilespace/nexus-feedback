import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';
import { useToast } from '@/components/Toast';
import type { CategoryConfig } from '@/types';

export function Categories() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const { show: toast } = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6B7280');

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories', projectId],
    queryFn: () => apiRequest<CategoryConfig[]>(`/org/projects/${projectId}/categories`),
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest(`/org/projects/${projectId}/categories`, {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', projectId] });
      setName('');
      setColor('#6B7280');
      toast('分类添加成功');
    },
    onError: (err) => toast(err instanceof Error ? err.message : '添加失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/org/projects/${projectId}/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', projectId] });
      toast('分类已删除');
    },
    onError: (err) => toast(err instanceof Error ? err.message : '删除失败', 'error'),
  });

  if (!projectId) {
    return <p className="text-sm text-gray-500">请先选择一个项目</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">自定义分类</h1>
      <form
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) createMutation.mutate(); }}
        className="flex gap-3 rounded-xl border border-surface-3 bg-surface-0 p-5 dark:border-gray-700 dark:bg-gray-800"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="分类名称"
          className="flex-1 rounded-lg border border-surface-3 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          required
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-10 w-10 cursor-pointer rounded border-0"
        />
        <button
          type="submit"
          disabled={createMutation.isPending || !name.trim()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          添加
        </button>
      </form>
      {isLoading && <p className="text-sm text-gray-400">加载中...</p>}
      {categories && categories.length > 0 && (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 rounded-xl border border-surface-3 bg-surface-0 px-5 py-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="h-4 w-4 rounded-full" style={{ backgroundColor: cat.color }} />
              <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{cat.name}</span>
              <button
                onClick={() => deleteMutation.mutate(cat.id)}
                className="text-xs text-red-500 hover:underline"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}
      {categories && categories.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">
          暂无自定义分类，将使用默认分类（Bug、功能、性能、UI、其他）
        </p>
      )}
    </div>
  );
}
