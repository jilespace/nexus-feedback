import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, fetchOrgTags, type OrgTagItem } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { Button, Card, CardHeader, EmptyState, Field, Skeleton, settingsInputClass } from '@/components/ui';
import { useToast } from '@/components/Toast';

const DEFAULT_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#6b7280',
];

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
  const [confirmDelete, setConfirmDelete] = useState<OrgTagItem | null>(null);

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
    mutationFn: (id: string) => apiRequest(`/org/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-tags'] });
      setConfirmDelete(null);
      toast.show('标签已删除');
    },
    onError: (err) => {
      setConfirmDelete(null);
      toast.show(err instanceof Error ? err.message : '删除失败', 'error');
    },
  });

  const canManage = member?.role === 'owner' || member?.role === 'admin';
  const list = tags ?? [];

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="标签管理"
        description="标签用于给反馈打分类标记，可在反馈列表按标签筛选，帮助团队归类与追踪问题。"
      />

      {canManage && (
        <Card className="p-5">
          <CardHeader
            title="新建标签"
            description="从常用预设开始，或自定义名称与颜色。"
            className="mb-4"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">预设</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  setName(preset.name);
                  setColor(preset.color);
                }}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-surface-3 bg-surface-0 px-2.5 text-xs font-medium text-gray-600 transition-colors hover:border-brand-300 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: preset.color }} />
                {preset.name}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) createMutation.mutate({ name: name.trim(), color });
            }}
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <Field label="标签名称" htmlFor="tag-name" className="min-w-0 flex-1">
              <input
                id="tag-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：需要复查"
                required
                className={settingsInputClass()}
              />
            </Field>
            <Field label="颜色">
              <div className="flex h-9 items-center gap-1.5">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`选择颜色 ${c}`}
                    aria-pressed={color === c}
                    className={`h-6 w-6 rounded-full ring-offset-2 transition-all dark:ring-offset-gray-800 ${
                      color === c
                        ? 'scale-110 ring-2 ring-gray-900 dark:ring-white'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </Field>
            <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
              {createMutation.isPending ? '创建中...' : '创建标签'}
            </Button>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-surface-2 px-5 py-3.5 dark:border-gray-700/60">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            全部标签
            <span className="ml-1.5 font-normal text-gray-400">({list.length})</span>
          </h2>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            title="还没有标签"
            description="从上方常用预设快速创建，或自定义一个标签"
          />
        ) : (
          <ul className="divide-y divide-surface-2 dark:divide-gray-700/60">
            {list.map((tag) => {
              const usage = tag.usage_count ?? 0;
              return (
                <li
                  key={tag.id}
                  className="group flex items-center justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-surface-1/60 dark:hover:bg-gray-700/20"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color ?? '#6b7280' }}
                    />
                    <span className="truncate text-[13px] font-medium text-gray-800 dark:text-gray-200">
                      {tag.name}
                    </span>
                    <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] tabular-nums text-gray-500 dark:bg-gray-700/60 dark:text-gray-400">
                      {usage} 条反馈
                    </span>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(tag)}
                      aria-label={`删除标签 ${tag.name}`}
                      className="rounded-md px-1.5 py-1 text-[11px] font-medium text-gray-500 opacity-0 transition-all hover:text-rose-500 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 group-hover:opacity-100 dark:text-gray-400 dark:hover:text-rose-400"
                    >
                      删除
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {confirmDelete && (
        <Modal
          title="删除标签"
          description={`确定删除标签「${confirmDelete.name}」吗？`}
          onClose={() => setConfirmDelete(null)}
          size="sm"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>
                取消
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
              >
                {deleteMutation.isPending ? '删除中...' : '确认删除'}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {(confirmDelete.usage_count ?? 0) > 0
              ? `该标签已被 ${confirmDelete.usage_count} 条反馈使用，删除后会同时解除这些反馈的标签关联。`
              : '删除后不可恢复。'}
          </p>
        </Modal>
      )}
    </div>
  );
}
