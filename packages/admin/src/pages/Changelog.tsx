import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { apiRequest } from '@/api/client';
import { useToast } from '@/components/Toast';
import type { ChangelogEntry, ProjectAccessInfo, FeedbackItem } from '@/types';

type ChangelogFormData = { title: string; content: string; project_id: string };
type EditingState = { id: string; title: string; content: string } | null;

export function Changelog() {
  const queryClient = useQueryClient();
  const { show: toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EditingState>(null);
  const [form, setForm] = useState<ChangelogFormData>({ title: '', content: '', project_id: '' });
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['changelog'],
    queryFn: () => apiRequest<{ items: ChangelogEntry[] }>('/org/changelog'),
  });
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiRequest<ProjectAccessInfo[]>('/org/projects'),
  });
  const { data: resolvedFeedbacks } = useQuery({
    queryKey: ['feedback', 'resolved'],
    queryFn: () => apiRequest<{ items: FeedbackItem[] }>('/admin/feedback?status=resolved&page_size=50'),
    enabled: linkingId !== null,
  });

  const createMutation = useMutation({
    mutationFn: (payload: ChangelogFormData) =>
      apiRequest<ChangelogEntry>('/org/changelog', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => { toast('已创建', 'success'); resetForm(); queryClient.invalidateQueries({ queryKey: ['changelog'] }); },
    onError: (err: Error) => toast(err.message || '创建失败', 'error'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, title, content }: { id: string; title?: string; content?: string }) =>
      apiRequest<ChangelogEntry>('/org/changelog/' + id, { method: 'PATCH', body: JSON.stringify({ title, content }) }),
    onSuccess: () => { toast('已更新', 'success'); setEditing(null); queryClient.invalidateQueries({ queryKey: ['changelog'] }); },
    onError: (err: Error) => toast(err.message || '更新失败', 'error'),
  });
  const publishMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'publish' | 'unpublish' }) =>
      apiRequest<ChangelogEntry>('/org/changelog/' + id + '/' + action, { method: 'POST' }),
    onSuccess: (_, { action }) => { toast(action === 'publish' ? '已发布' : '已取消发布', 'success'); queryClient.invalidateQueries({ queryKey: ['changelog'] }); },
    onError: (err: Error) => toast(err.message || '操作失败', 'error'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest('/org/changelog/' + id, { method: 'DELETE' }),
    onSuccess: () => { toast('已删除', 'success'); setConfirmDelete(null); queryClient.invalidateQueries({ queryKey: ['changelog'] }); },
    onError: (err: Error) => toast(err.message || '删除失败', 'error'),
  });
  const linkFeedbackMutation = useMutation({
    mutationFn: ({ id, feedback_id }: { id: string; feedback_id: string }) =>
      apiRequest('/org/changelog/' + id + '/feedback', { method: 'POST', body: JSON.stringify({ feedback_id }) }),
    onSuccess: () => { toast('已关联反馈', 'success'); setLinkingId(null); queryClient.invalidateQueries({ queryKey: ['changelog'] }); },
    onError: (err: Error) => toast(err.message || '关联失败', 'error'),
  });
  const unlinkFeedbackMutation = useMutation({
    mutationFn: ({ id, feedbackId }: { id: string; feedbackId: string }) =>
      apiRequest('/org/changelog/' + id + '/feedback/' + feedbackId, { method: 'DELETE' }),
    onSuccess: () => { toast('已取消关联', 'success'); queryClient.invalidateQueries({ queryKey: ['changelog'] }); },
    onError: (err: Error) => toast(err.message || '取消关联失败', 'error'),
  });

  function resetForm() { setForm({ title: '', content: '', project_id: '' }); setShowForm(false); }
  function startEdit(entry: ChangelogEntry) { setEditing({ id: entry.id, title: entry.title, content: entry.content }); }
  function getProjectName(projectId: string | null) {
    if (!projectId || !projects) return '—';
    return projects.find((project) => project.id === projectId)?.name ?? '—';
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-3/60" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-3/60" />
        ))}
      </div>
    );
  }

  const entries = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">更新日志</h1>
        <button onClick={() => setShowForm(true)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700">
          创建更新
        </button>
      </div>
      {showForm && <CreateForm form={form} setForm={setForm} projects={projects ?? []} onSubmit={() => createMutation.mutate(form)} onCancel={resetForm} isPending={createMutation.isPending} />}
      {entries.length === 0 && !showForm && <EmptyState />}
      <div className="space-y-3">
        {entries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} editing={editing} setEditing={setEditing} getProjectName={getProjectName} onStartEdit={startEdit} onUpdate={updateMutation.mutate} onPublish={(id, action) => publishMutation.mutate({ id, action })} onDelete={(id) => setConfirmDelete(id)} onLinkFeedback={(id) => setLinkingId(id)} onUnlinkFeedback={(id, fid) => unlinkFeedbackMutation.mutate({ id, feedbackId: fid })} />
        ))}
      </div>
      {confirmDelete && <ConfirmModal message="确定要删除这条更新日志吗？" onConfirm={() => deleteMutation.mutate(confirmDelete)} onCancel={() => setConfirmDelete(null)} isPending={deleteMutation.isPending} />}
      {linkingId && <LinkFeedbackModal feedbacks={resolvedFeedbacks?.items ?? []} onLink={(fid) => linkFeedbackMutation.mutate({ id: linkingId, feedback_id: fid })} onCancel={() => setLinkingId(null)} isPending={linkFeedbackMutation.isPending} />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-surface-3 bg-surface-0 py-16 dark:border-gray-600 dark:bg-gray-800">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="4" y="3" width="12" height="14" rx="2" fill="currentColor" className="text-gray-300" opacity="0.7" />
          <path d="M7 7h6M7 10h5M7 13h3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">暂无更新日志</p>
      <p className="mt-1 text-xs text-gray-400">点击"创建更新"添加第一条</p>
    </div>
  );
}

function CreateForm({ form, setForm, projects, onSubmit, onCancel, isPending }: {
  form: ChangelogFormData; setForm: (f: ChangelogFormData) => void; projects: ProjectAccessInfo[];
  onSubmit: () => void; onCancel: () => void; isPending: boolean;
}) {
  return (
    <div className="rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-sm dark:border-gray-600 dark:bg-gray-800">
      <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">创建更新日志</h2>
      <div className="space-y-3">
        <input type="text" placeholder="标题" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
        <textarea placeholder="内容（支持 Markdown）" rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="w-full resize-none rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
        <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-gray-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
          <option value="">选择项目</option>
          {projects.map((project) => (<option key={project.id} value={project.id}>{project.name}</option>))}
        </select>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={onSubmit} disabled={!form.title.trim() || !form.project_id || isPending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50">
          {isPending ? '创建中...' : '创建'}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-surface-3 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-surface-2">
          取消
        </button>
      </div>
    </div>
  );
}

function EntryCard({ entry, editing, setEditing, getProjectName, onStartEdit, onUpdate, onPublish, onDelete, onLinkFeedback, onUnlinkFeedback }: {
  entry: ChangelogEntry; editing: EditingState; setEditing: (e: EditingState) => void;
  getProjectName: (id: string | null) => string; onStartEdit: (e: ChangelogEntry) => void;
  onUpdate: (d: { id: string; title?: string; content?: string }) => void;
  onPublish: (id: string, action: 'publish' | 'unpublish') => void;
  onDelete: (id: string) => void; onLinkFeedback: (id: string) => void;
  onUnlinkFeedback: (id: string, feedbackId: string) => void;
}) {
  const isEditing = editing?.id === entry.id;
  if (isEditing) {
    return (
      <div className="space-y-3 rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-sm">
        <input type="text" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-gray-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100" />
        <textarea rows={4} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} className="w-full resize-none rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-gray-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100" />
        <div className="flex gap-2">
          <button onClick={() => onUpdate({ id: entry.id, title: editing.title, content: editing.content })} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">保存</button>
          <button onClick={() => setEditing(null)} className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-surface-2">取消</button>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900">{entry.title}</h3>
            <span className={clsx('inline-block h-2 w-2 rounded-full', entry.published ? 'bg-green-500' : 'bg-gray-300')} title={entry.published ? '已发布' : '草稿'} />
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-gray-500">{entry.content}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
        <span>{getProjectName(entry.project_id)}</span>
        <span>{entry.published_at ? new Date(entry.published_at).toLocaleDateString() : '草稿'}</span>
      </div>
      {entry.feedbacks && entry.feedbacks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {entry.feedbacks.map((fb) => (
            <span key={fb.id} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
              {fb.title}
              <button onClick={() => onUnlinkFeedback(entry.id, fb.id)} className="ml-0.5 text-brand-400 hover:text-brand-700">&times;</button>
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2 border-t border-surface-3 pt-3">
        <button onClick={() => onStartEdit(entry)} className="rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-surface-2">编辑</button>
        <button onClick={() => onPublish(entry.id, entry.published ? 'unpublish' : 'publish')} className={clsx('rounded-md px-2.5 py-1 text-xs font-medium transition-colors', entry.published ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50')}>
          {entry.published ? '取消发布' : '发布'}
        </button>
        <button onClick={() => onLinkFeedback(entry.id)} className="rounded-md px-2.5 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50">关联反馈</button>
        <button onClick={() => onDelete(entry.id)} className="rounded-md px-2.5 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50">删除</button>
      </div>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel, isPending }: {
  message: string; onConfirm: () => void; onCancel: () => void; isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-80 rounded-xl bg-surface-0 p-6 shadow-lg">
        <p className="text-sm text-gray-900">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-surface-2">取消</button>
          <button onClick={onConfirm} disabled={isPending} className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50">
            {isPending ? '删除中...' : '确认删除'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LinkFeedbackModal({ feedbacks, onLink, onCancel, isPending }: {
  feedbacks: FeedbackItem[]; onLink: (id: string) => void; onCancel: () => void; isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-96 rounded-xl bg-surface-0 p-6 shadow-lg">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">关联已解决的反馈</h3>
        {feedbacks.length === 0 ? (
          <p className="text-xs text-gray-400">暂无已解决的反馈</p>
        ) : (
          <div className="max-h-60 space-y-1.5 overflow-y-auto">
            {feedbacks.map((fb) => (
              <button key={fb.id} onClick={() => onLink(fb.id)} disabled={isPending} className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-surface-2 disabled:opacity-50">
                {fb.title}
              </button>
            ))}
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <button onClick={onCancel} className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-surface-2">取消</button>
        </div>
      </div>
    </div>
  );
}
