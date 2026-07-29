import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';
import { useToast } from '@/components/Toast';
import { WebhookLogs } from '@/components/WebhookLogs';
import type { Webhook } from '@/types';

const AVAILABLE_EVENTS = [
  { value: 'feedback.created', label: '反馈创建' },
  { value: 'feedback.status_changed', label: '状态变更' },
  { value: 'feedback.assigned', label: '反馈指派' },
  { value: 'feedback.merged', label: '反馈合并' },
  { value: 'comment.created', label: '新评论' },
];

export function Webhooks() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [formUrl, setFormUrl] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formSecret, setFormSecret] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['webhooks', projectId],
    queryFn: () => apiRequest<Webhook[]>(`/org/projects/${projectId}/webhooks`),
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { url: string; events: string[]; secret?: string }) =>
      apiRequest(`/org/projects/${projectId}/webhooks`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', projectId] });
      resetForm();
      toast.show('Webhook 创建成功');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '创建失败', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; url?: string; events?: string[]; active?: boolean }) =>
      apiRequest(`/org/projects/${projectId}/webhooks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', projectId] });
      resetForm();
      toast.show('Webhook 更新成功');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '更新失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/org/projects/${projectId}/webhooks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', projectId] });
      toast.show('Webhook 已删除');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '删除失败', 'error'),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ status: number; ok: boolean }>(`/org/projects/${projectId}/webhooks/${id}/test`, { method: 'POST' }),
    onSuccess: (data) => {
      toast.show(data.ok ? '测试发送成功' : `测试失败 (HTTP ${data.status})`);
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '测试失败', 'error'),
  });

  function resetForm() {
    setShowForm(false);
    setFormUrl('');
    setFormEvents([]);
    setFormSecret('');
    setEditingId(null);
  }

  function startEdit(webhook: Webhook) {
    setEditingId(webhook.id);
    setFormUrl(webhook.url);
    setFormEvents(webhook.events);
    setFormSecret(webhook.secret);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, url: formUrl, events: formEvents });
    } else {
      createMutation.mutate({ url: formUrl, events: formEvents, secret: formSecret || undefined });
    }
  }

  function toggleEvent(event: string) {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  if (!projectId) {
    return <p className="text-sm text-gray-500">请先选择一个项目</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Webhooks</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
        >
          添加 Webhook
        </button>
      </div>
      {isLoading && <p className="text-sm text-gray-400">加载中...</p>}
      {webhooks && webhooks.length === 0 && !showForm && (
        <p className="py-8 text-center text-sm text-gray-400">暂无 Webhook</p>
      )}
      {webhooks && webhooks.length > 0 && (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div key={wh.id} className="rounded-xl border border-surface-3 bg-surface-0 px-5 py-4 dark:border-gray-600 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{wh.url}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    事件: {wh.events.join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateMutation.mutate({ id: wh.id, active: !wh.active })}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${wh.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {wh.active ? '启用' : '禁用'}
                  </button>
                  <button
                    onClick={() => testMutation.mutate(wh.id)}
                    disabled={testMutation.isPending}
                    className="rounded-lg border border-surface-3 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-surface-2"
                  >
                    测试
                  </button>
                  <button onClick={() => startEdit(wh)} className="text-xs text-brand-600 hover:underline">编辑</button>
                  <button
                    onClick={() => setExpandedId(expandedId === wh.id ? null : wh.id)}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    {expandedId === wh.id ? '收起日志' : '查看日志'}
                  </button>
                  <button onClick={() => deleteMutation.mutate(wh.id)} className="text-xs text-red-500 hover:underline">删除</button>
                </div>
              </div>
              {expandedId === wh.id && <WebhookLogs webhookId={wh.id} projectId={projectId} />}
            </div>
          ))}
        </div>
      )}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-surface-3 bg-surface-0 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">{editingId ? '编辑 Webhook' : '添加 Webhook'}</h3>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
            <input
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              className="w-full rounded-lg border border-surface-3 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">事件</label>
            <div className="flex gap-3">
              {AVAILABLE_EVENTS.map((ev) => (
                <label key={ev.value} className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={formEvents.includes(ev.value)}
                    onChange={() => toggleEvent(ev.value)}
                    className="rounded border-gray-300"
                  />
                  {ev.label}
                </label>
              ))}
            </div>
          </div>
          {!editingId && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Secret（留空自动生成）</label>
              <input
                value={formSecret}
                onChange={(e) => setFormSecret(e.target.value)}
                placeholder="自动生成"
                className="w-full rounded-lg border border-surface-3 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {editingId ? '保存' : '创建'}
            </button>
            <button type="button" onClick={resetForm} className="rounded-lg border border-surface-3 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-surface-2">
              取消
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
