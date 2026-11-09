import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { apiRequest } from '@/api/client';
import { MarkdownToolbar } from '@/components/MarkdownToolbar';
import { Modal } from '@/components/Modal';
import { PageHeader } from '@/components/PageHeader';
import { Badge, Button, Card, EmptyState, Skeleton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { formatDateTime, markdownToPlainText } from '@/utils/markdown';
import type { ChangelogEntry, ProjectAccessInfo, FeedbackItem } from '@/types';

type ChangelogFormData = {
  title: string;
  content: string;
  project_id: string;
  publish_at: string;
};
type EditingState = { id: string; title: string; content: string; publish_at: string } | null;

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Changelog() {
  const queryClient = useQueryClient();
  const { show: toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EditingState>(null);
  const [form, setForm] = useState<ChangelogFormData>({
    title: '',
    content: '',
    project_id: '',
    publish_at: '',
  });
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
    queryFn: () =>
      apiRequest<{ items: FeedbackItem[] }>('/admin/feedback?status=resolved&page_size=50'),
    enabled: linkingId !== null,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['changelog'] });

  const createMutation = useMutation({
    mutationFn: (payload: ChangelogFormData) =>
      apiRequest<ChangelogEntry>('/org/changelog', {
        method: 'POST',
        body: JSON.stringify({ ...payload, publish_at: payload.publish_at || null }),
      }),
    onSuccess: () => {
      toast('已创建', 'success');
      resetForm();
      invalidate();
    },
    onError: (err: Error) => toast(err.message || '创建失败', 'error'),
  });
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      title,
      content,
      publish_at,
    }: {
      id: string;
      title?: string;
      content?: string;
      publish_at?: string;
    }) =>
      apiRequest<ChangelogEntry>(`/org/changelog/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          content,
          publish_at: publish_at ? new Date(publish_at).toISOString() : null,
        }),
      }),
    onSuccess: () => {
      toast('已更新', 'success');
      setEditing(null);
      invalidate();
    },
    onError: (err: Error) => toast(err.message || '更新失败', 'error'),
  });
  const publishMutation = useMutation({
    mutationFn: ({
      id,
      action,
      publish_at,
    }: {
      id: string;
      action: 'publish' | 'unpublish';
      publish_at?: string;
    }) =>
      apiRequest<ChangelogEntry>(`/org/changelog/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify(publish_at ? { publish_at: new Date(publish_at).toISOString() } : {}),
      }),
    onSuccess: (_, { action }) => {
      toast(action === 'publish' ? '已发布' : '已取消发布', 'success');
      invalidate();
    },
    onError: (err: Error) => toast(err.message || '操作失败', 'error'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/org/changelog/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('已删除', 'success');
      setConfirmDelete(null);
      invalidate();
    },
    onError: (err: Error) => toast(err.message || '删除失败', 'error'),
  });
  const linkFeedbackMutation = useMutation({
    mutationFn: ({ id, feedback_id }: { id: string; feedback_id: string }) =>
      apiRequest(`/org/changelog/${id}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ feedback_id }),
      }),
    onSuccess: () => {
      toast('已关联反馈', 'success');
      setLinkingId(null);
      invalidate();
    },
    onError: (err: Error) => toast(err.message || '关联失败', 'error'),
  });
  const unlinkFeedbackMutation = useMutation({
    mutationFn: ({ id, feedbackId }: { id: string; feedbackId: string }) =>
      apiRequest(`/org/changelog/${id}/feedback/${feedbackId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('已取消关联', 'success');
      invalidate();
    },
    onError: (err: Error) => toast(err.message || '取消关联失败', 'error'),
  });

  function resetForm() {
    setForm({ title: '', content: '', project_id: '', publish_at: '' });
    setShowForm(false);
  }
  function startEdit(entry: ChangelogEntry) {
    setEditing({
      id: entry.id,
      title: entry.title,
      content: entry.content,
      publish_at: toLocalInput(entry.published_at),
    });
  }
  function getProjectName(projectId: string | null) {
    if (!projectId || !projects) return '—';
    return projects.find((project) => project.id === projectId)?.name ?? '—';
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const entries = data?.items ?? [];

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="更新日志"
        description="向用户发布产品更新动态，并关联已解决的反馈形成闭环。"
        actions={
          <Button onClick={() => setShowForm(true)} disabled={showForm}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            创建更新
          </Button>
        }
      />

      {showForm && (
        <CreateForm
          form={form}
          setForm={setForm}
          projects={projects ?? []}
          onSubmit={() => createMutation.mutate(form)}
          onCancel={resetForm}
          isPending={createMutation.isPending}
        />
      )}

      {entries.length === 0 && !showForm ? (
        <Card>
          <EmptyState
            title="暂无更新日志"
            description="发布第一条产品更新，让用户知道你们在持续迭代"
            action={{ label: '创建更新', onClick: () => setShowForm(true) }}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              editing={editing}
              setEditing={setEditing}
              getProjectName={getProjectName}
              onStartEdit={startEdit}
              onUpdate={(d) => updateMutation.mutate(d)}
              onPublish={(id, action, publishAt) =>
                publishMutation.mutate({ id, action, publish_at: publishAt })
              }
              onDelete={(id) => setConfirmDelete(id)}
              onLinkFeedback={(id) => setLinkingId(id)}
              onUnlinkFeedback={(id, fid) => unlinkFeedbackMutation.mutate({ id, feedbackId: fid })}
            />
          ))}
        </div>
      )}

      {confirmDelete && (
        <Modal
          title="删除更新日志"
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
                onClick={() => deleteMutation.mutate(confirmDelete)}
              >
                {deleteMutation.isPending ? '删除中...' : '确认删除'}
              </Button>
            </>
          }
        >
          <p className="text-sm text-gray-600 dark:text-gray-300">
            确定要删除这条更新日志吗？删除后不可恢复，已发布页面也会同步移除。
          </p>
        </Modal>
      )}

      {linkingId && (
        <Modal
          title="关联已解决的反馈"
          description="把这次更新与用户反馈关联起来，让用户看到建议被采纳。"
          onClose={() => setLinkingId(null)}
          size="md"
        >
          {(resolvedFeedbacks?.items ?? []).length === 0 ? (
            <p className="py-6 text-center text-xs text-gray-400 dark:text-gray-500">
              暂无已解决的反馈
            </p>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {(resolvedFeedbacks?.items ?? []).map((fb) => (
                <button
                  key={fb.id}
                  onClick={() => linkFeedbackMutation.mutate({ id: linkingId, feedback_id: fb.id })}
                  disabled={linkFeedbackMutation.isPending}
                  className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-gray-700 transition-colors hover:bg-surface-1 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700/50"
                >
                  {fb.title}
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">
      {children}
    </label>
  );
}

const inputClass =
  'h-9 w-full rounded-lg border border-surface-3 bg-surface-1/60 px-3 text-[13px] text-gray-900 placeholder:text-gray-400 transition-colors focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100';

function CreateForm({
  form,
  setForm,
  projects,
  onSubmit,
  onCancel,
  isPending,
}: {
  form: ChangelogFormData;
  setForm: (f: ChangelogFormData) => void;
  projects: ProjectAccessInfo[];
  onSubmit: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertMarkdown(text: string, cursorOffset: number) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + text + el.value.slice(end);
    setForm({ ...form, content: next });
    requestAnimationFrame(() => {
      el.focus();
      const pos = cursorOffset >= 0 ? start + cursorOffset : Math.min(start + text.length, next.length);
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <Card className="animate-fade-up p-5">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">创建更新日志</h2>
      <div className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>标题</FieldLabel>
            <input
              type="text"
              placeholder="例如：v2.4.0 — 更快的搜索与全新的移动端"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <FieldLabel>项目</FieldLabel>
            <select
              value={form.project_id}
              onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              className={inputClass}
            >
              <option value="">选择项目</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <FieldLabel>正文（支持 Markdown）</FieldLabel>
          <div className="overflow-hidden rounded-lg border border-surface-3 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/15 dark:border-gray-700">
            <div className="border-b border-surface-3 bg-surface-1/60 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-900/40">
              <MarkdownToolbar onInsert={insertMarkdown} />
            </div>
            <textarea
              ref={textareaRef}
              placeholder={'## 新功能\n- ...\n\n## 修复\n- ...'}
              rows={6}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="block w-full resize-none border-0 bg-surface-0 px-3 py-2.5 font-mono text-[13px] leading-relaxed text-gray-900 placeholder:text-gray-400 focus:outline-none dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        </div>

        <div className="max-w-xs">
          <FieldLabel>发布时间（留空立即发布）</FieldLabel>
          <input
            type="datetime-local"
            value={form.publish_at}
            onChange={(e) => setForm({ ...form, publish_at: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          onClick={onSubmit}
          disabled={!form.title.trim() || !form.project_id || isPending}
        >
          {isPending ? '创建中...' : '创建'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          取消
        </Button>
      </div>
    </Card>
  );
}

function entryStatus(entry: ChangelogEntry): { label: string; tone: 'gray' | 'green' | 'amber' } {
  if (entry.published && entry.published_at && new Date(entry.published_at).getTime() > Date.now()) {
    return { label: '定时发布', tone: 'amber' };
  }
  if (entry.published) return { label: '已发布', tone: 'green' };
  return { label: '草稿', tone: 'gray' };
}

function EntryCard({
  entry,
  editing,
  setEditing,
  getProjectName,
  onStartEdit,
  onUpdate,
  onPublish,
  onDelete,
  onLinkFeedback,
  onUnlinkFeedback,
}: {
  entry: ChangelogEntry;
  editing: EditingState;
  setEditing: (e: EditingState) => void;
  getProjectName: (id: string | null) => string;
  onStartEdit: (e: ChangelogEntry) => void;
  onUpdate: (d: { id: string; title?: string; content?: string; publish_at?: string }) => void;
  onPublish: (id: string, action: 'publish' | 'unpublish', publishAt?: string) => void;
  onDelete: (id: string) => void;
  onLinkFeedback: (id: string) => void;
  onUnlinkFeedback: (id: string, feedbackId: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEditing = editing?.id === entry.id;
  const status = entryStatus(entry);

  function insertMarkdown(text: string, cursorOffset: number) {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + text + el.value.slice(end);
    setEditing({ ...editing, content: next });
    requestAnimationFrame(() => {
      el.focus();
      const pos = cursorOffset >= 0 ? start + cursorOffset : Math.min(start + text.length, next.length);
      el.setSelectionRange(pos, pos);
    });
  }

  if (isEditing) {
    return (
      <Card className="animate-fade-up p-5">
        <div className="space-y-3">
          <input
            type="text"
            value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            className={inputClass}
          />
          <div className="overflow-hidden rounded-lg border border-surface-3 focus-within:border-brand-400 dark:border-gray-700">
            <div className="border-b border-surface-3 bg-surface-1/60 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-900/40">
              <MarkdownToolbar onInsert={insertMarkdown} />
            </div>
            <textarea
              ref={textareaRef}
              rows={5}
              value={editing.content}
              onChange={(e) => setEditing({ ...editing, content: e.target.value })}
              className="block w-full resize-none border-0 bg-surface-0 px-3 py-2.5 font-mono text-[13px] leading-relaxed text-gray-900 focus:outline-none dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <FieldLabel>发布时间（清空并保存则立即发布）</FieldLabel>
              <input
                type="datetime-local"
                value={editing.publish_at}
                onChange={(e) => setEditing({ ...editing, publish_at: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            onClick={() =>
              onUpdate({
                id: entry.id,
                title: editing.title,
                content: editing.content,
                publish_at: editing.publish_at,
              })
            }
          >
            保存
          </Button>
          <Button variant="secondary" onClick={() => setEditing(null)}>
            取消
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 transition-shadow hover:shadow-card-hover">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-gray-900 dark:text-gray-50">
              {entry.title}
            </h3>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
            {markdownToPlainText(entry.content) || '暂无正文'}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400 dark:text-gray-500">
            <span className="inline-flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M2.5 5.5 8 2.5l5.5 3L8 8.5l-5.5-3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                <path d="m2.5 8.5 5.5 3 5.5-3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
              {getProjectName(entry.project_id)}
            </span>
            {entry.published_at && (
              <span className="inline-flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M8 5v3.2l2 1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                {status.tone === 'amber' ? '计划 ' : ''}
                {formatDateTime(entry.published_at)}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => onStartEdit(entry)}>
            编辑
          </Button>
          {entry.published ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPublish(entry.id, 'unpublish')}
            >
              取消发布
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => onPublish(entry.id, 'publish')}>
                发布
              </Button>
              <SchedulePublishButton onPublish={(iso) => onPublish(entry.id, 'publish', iso)} />
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => onLinkFeedback(entry.id)}>
            关联反馈
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
            onClick={() => onDelete(entry.id)}
          >
            删除
          </Button>
        </div>
      </div>

      {entry.feedbacks && entry.feedbacks.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-surface-2 pt-3 dark:border-gray-700/60">
          <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">关联反馈</span>
          {entry.feedbacks.map((fb) => (
            <span
              key={fb.id}
              className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700 dark:bg-brand-600/15 dark:text-brand-300"
            >
              {fb.title}
              <button
                onClick={() => onUnlinkFeedback(entry.id, fb.id)}
                className="text-brand-400 transition-colors hover:text-brand-700 dark:hover:text-brand-200"
                aria-label={`取消关联 ${fb.title}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function SchedulePublishButton({ onPublish }: { onPublish: (iso: string) => void }) {
  const [scheduledAt, setScheduledAt] = useState('');
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="datetime-local"
        value={scheduledAt}
        onChange={(e) => setScheduledAt(e.target.value)}
        title="发布时间（留空立即发布）"
        className="h-8 rounded-lg border border-surface-3 bg-surface-0 px-1.5 text-[11px] text-gray-600 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (scheduledAt) {
            onPublish(new Date(scheduledAt).toISOString());
            setScheduledAt('');
          }
        }}
        disabled={!scheduledAt}
        className={clsx(!scheduledAt && 'opacity-40')}
      >
        定时
      </Button>
    </span>
  );
}
