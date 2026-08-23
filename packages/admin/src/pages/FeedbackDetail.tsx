import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { apiRequest, assignFeedback, fetchOrgMembers } from '@/api/client';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import { useAuth } from '@/hooks/useAuth';
import type { FeedbackDetail as FeedbackDetailType, FeedbackPriority, FeedbackItem, Tag } from '@/types';
import type { PaginatedResponse } from '@/types';

type InternalNote = {
  id: string;
  content: string;
  created_at: string;
  member: { id: string; display_name: string; email: string };
};

type StatusHistoryItem = {
  id: string;
  old_status: string;
  new_status: string;
  created_at: string;
  member?: { id: string; display_name: string } | null;
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress', 'closed'],
  in_progress: ['resolved', 'closed'],
  resolved: ['in_progress', 'closed'],
  closed: [],
};

const STATUS_LABELS: Record<string, string> = {
  open: '待处理', in_progress: '进行中', resolved: '已解决', closed: '已关闭',
};

const PRIORITY_CONFIG: Record<FeedbackPriority, { label: string; className: string }> = {
  low: { label: '低', className: 'text-gray-600' },
  medium: { label: '中', className: 'text-blue-600' },
  high: { label: '高', className: 'text-orange-600' },
  critical: { label: '紧急', className: 'text-red-600' },
};

export function FeedbackDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { member } = useAuth();
  const canAssign = member?.role === 'owner' || member?.role === 'admin';
  const [replyContent, setReplyContent] = useState('');
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSearch, setMergeSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['feedback', id],
    queryFn: () => apiRequest<FeedbackDetailType>(`/admin/feedback/${id}`),
    enabled: !!id,
  });

  const { data: searchResults } = useQuery({
    queryKey: ['feedback-search', mergeSearch],
    queryFn: () => apiRequest<PaginatedResponse<FeedbackItem>>(`/admin/feedback?keyword=${encodeURIComponent(mergeSearch)}&page_size=5`),
    enabled: mergeSearch.length > 1,
  });

  const mergeMutation = useMutation({
    mutationFn: (targetId: string) =>
      apiRequest(`/admin/feedback/${id}/merge`, {
        method: 'POST',
        body: JSON.stringify({ target_id: targetId }),
      }),
    onSuccess: (_data, targetId) => {
      setShowMergeModal(false);
      toast.show('反馈合并成功');
      navigate(`/feedback/${targetId}`);
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '合并失败', 'error'),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      apiRequest(`/admin/feedback/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_data, status) => {
      queryClient.invalidateQueries({ queryKey: ['feedback', id] });
      toast.show(`状态已更新为「${STATUS_LABELS[status] ?? status}」`);
    },
    onError: () => toast.show('状态更新失败', 'error'),
  });

  const replyMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest(`/admin/feedback/${id}/replies`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback', id] });
      setReplyContent('');
      toast.show('回复已发送');
    },
    onError: () => toast.show('回复发送失败', 'error'),
  });

  const { data: members } = useQuery({
    queryKey: ['org-members'],
    queryFn: fetchOrgMembers,
  });

  const assignMutation = useMutation({
    mutationFn: (assigneeId: string | null) => assignFeedback(id!, assigneeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback', id] });
      toast.show('指派已更新');
    },
    onError: () => toast.show('指派失败', 'error'),
  });

  const { data: allTags } = useQuery({
    queryKey: ['org-tags'],
    queryFn: () => apiRequest<Tag[]>('/org/tags'),
  });

  const assignTagMutation = useMutation({
    mutationFn: (tagId: string) =>
      apiRequest(`/org/feedback/${id}/tags`, {
        method: 'POST',
        body: JSON.stringify({ tag_id: tagId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback', id] });
      toast.show('标签已添加');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '添加标签失败', 'error'),
  });

  const removeTagMutation = useMutation({
    mutationFn: (tagId: string) =>
      apiRequest(`/org/feedback/${id}/tags/${tagId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback', id] });
      toast.show('标签已移除');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '移除标签失败', 'error'),
  });

  if (isLoading) return <DetailSkeleton />;
  if (!data) return <div className="text-sm text-red-600">未找到反馈</div>;

  const allowedTransitions = STATUS_TRANSITIONS[data.status] ?? [];
  const priorityConfig = PRIORITY_CONFIG[data.priority];

  return (
    <div className="space-y-4 animate-fade-in">
      <button
        onClick={() => navigate('/feedback')}
        className="flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-brand-600 focus:outline-none"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        返回列表
      </button>
      {data.merged_into_id && data.merged_into && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1v14M4 5l4-4 4 4M4 11l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          此反馈已合并到{' '}
          <Link to={`/feedback/${data.merged_into.id}`} className="font-medium text-amber-900 underline hover:no-underline">
            {data.merged_into.title}
          </Link>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Main Content */}
        <div className="space-y-4">
          {/* Feedback Info Card */}
          <div className="rounded-xl border border-surface-3 bg-surface-0 shadow-sm dark:border-gray-600 dark:bg-gray-800">
            <div className="border-b border-surface-3 p-5 dark:border-gray-600">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{data.title}</h1>
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {data.project.name} · {formatRelativeTime(data.created_at)}
                  </p>
                </div>
                <StatusBadge status={data.status} />
              </div>
            </div>
            <div className="p-5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">{data.content}</p>
            </div>
            {/* Meta Info */}
            <div className="border-t border-surface-3 bg-surface-1/50 px-5 py-3 dark:border-gray-600 dark:bg-gray-700/50">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                <span className="text-gray-500">分类：<span className="font-medium text-gray-700 dark:text-gray-300">{data.category}</span></span>
                <span className="text-gray-500">优先级：<span className={clsx('font-medium', priorityConfig.className)}>{priorityConfig.label}</span></span>
                {data.contact && <span className="text-gray-500">联系：<span className="font-medium text-gray-700 dark:text-gray-300">{data.contact}</span></span>}
                {data.app_version && <span className="text-gray-500">版本：<span className="font-medium text-gray-700 dark:text-gray-300">v{data.app_version}</span></span>}
              </div>
            </div>
          </div>

          {/* Attachments */}
          {data.attachments.length > 0 && (
            <div className="rounded-xl border border-surface-3 bg-surface-0 p-5 dark:border-gray-600 dark:bg-gray-800">
              <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">附件 ({data.attachments.length})</h2>
              <div className="flex flex-wrap gap-3">
                {data.attachments.map((a) => {
                  const fileUrl = `/api/v1/upload/files/${a.id}`;
                  const isImage = /^image\/(png|jpe?g|gif|webp)$/i.test(a.mime_type);
                  return isImage ? (
                    <a key={a.id} href={fileUrl} target="_blank" rel="noopener noreferrer" className="group block overflow-hidden rounded-lg border border-surface-3 transition-colors hover:border-brand-300">
                      <img src={fileUrl} alt={a.filename} className="max-h-[200px] w-auto object-contain" />
                      <div className="border-t border-surface-3 bg-surface-1 px-2 py-1 text-xs text-gray-600 group-hover:text-brand-700">{a.filename} ({(a.size / 1024).toFixed(0)} KB)</div>
                    </a>
                  ) : (
                    <a key={a.id} href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-surface-3 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 1h5l4 4v8H3V1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M8 1v4h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      {a.filename} ({(a.size / 1024).toFixed(0)} KB)
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Replies */}
          <div className="rounded-xl border border-surface-3 bg-surface-0 p-5 dark:border-gray-600 dark:bg-gray-800">
            <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">回复 ({data.replies.length})</h2>
            {data.replies.length > 0 ? (
              <div className="relative space-y-4 pl-4">
                <div className="absolute bottom-2 left-[7px] top-2 w-px bg-surface-3" />
                {data.replies.map((r) => (
                  <div key={r.id} className="relative">
                    <div className="absolute -left-4 top-3 h-2.5 w-2.5 rounded-full border-2 border-brand-300 bg-surface-0" />
                    <div className="ml-2 rounded-lg bg-surface-1 p-3">
                      <p className="text-sm text-gray-700 dark:text-gray-300">{r.content}</p>
                      <p className="mt-1.5 text-xs text-gray-400">{r.member?.display_name ?? '系统'} · {formatRelativeTime(r.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-gray-400">暂无回复</p>
            )}
            {data.status !== 'closed' && (
              <form onSubmit={(e) => { e.preventDefault(); if (replyContent.trim()) replyMutation.mutate(replyContent.trim()); }} className="mt-4 flex gap-2">
                <input value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="输入回复内容..." className="flex-1 rounded-xl border border-surface-3 bg-surface-1 px-4 py-2.5 text-sm transition-all placeholder:text-gray-400 focus:border-brand-500 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-100" />
                <button type="submit" disabled={!replyContent.trim() || replyMutation.isPending} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md disabled:opacity-50 disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-brand-200">回复</button>
              </form>
            )}
          </div>

          <InternalNotesSection feedbackId={id!} />
          <StatusHistorySection feedbackId={id!} />
        </div>

        {/* Sidebar - Actions */}
        <div className="space-y-4">
          {/* Status Actions */}
          {allowedTransitions.length > 0 && (
            <div className="rounded-xl border border-surface-3 bg-surface-0 p-4 dark:border-gray-600 dark:bg-gray-800">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">状态变更</h3>
              <div className="flex flex-wrap gap-2">
                {allowedTransitions.map((s) => (
                  <button key={s} onClick={() => statusMutation.mutate(s)} disabled={statusMutation.isPending} className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-1.5 text-sm font-medium transition-all hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-100">
                    {STATUS_LABELS[s] ?? s}
                  </button>
                ))}
              </div>
              {!data.merged_into_id && (
                <button onClick={() => setShowMergeModal(true)} className="mt-3 w-full rounded-lg border border-surface-3 px-3 py-1.5 text-sm font-medium text-gray-600 transition-all hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-100">
                  合并到...
                </button>
              )}
            </div>
          )}

          {/* Assignee */}
          <div className="rounded-xl border border-surface-3 bg-surface-0 p-4 dark:border-gray-600 dark:bg-gray-800">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">负责人</h3>
            {canAssign ? (
              <select value={data.assignee_id ?? ''} onChange={(e) => assignMutation.mutate(e.target.value || null)} disabled={assignMutation.isPending} className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-1.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">
                <option value="">未指派</option>
                {members?.map((m) => (
                  <option key={m.id} value={m.id}>{m.display_name}</option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2">
                {data.assignee ? (
                  <>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">{data.assignee.display_name.charAt(0)}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{data.assignee.display_name}</p>
                      <p className="text-xs text-gray-400">{data.assignee.email}</p>
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-gray-400">未指派</span>
                )}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="rounded-xl border border-surface-3 bg-surface-0 p-4 dark:border-gray-600 dark:bg-gray-800">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">标签</h3>
            <div className="flex flex-wrap items-center gap-2">
              {data.tags?.map((tag) => (
                <span key={tag.id} className="inline-flex items-center gap-1.5 rounded-full border border-surface-3 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-600 dark:text-gray-300">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color ?? '#6b7280' }} />
                  {tag.name}
                  <button onClick={() => removeTagMutation.mutate(tag.id)} className="ml-0.5 text-gray-400 hover:text-red-500" disabled={removeTagMutation.isPending}>×</button>
                </span>
              ))}
              {(!data.tags || data.tags.length === 0) && (
                <span className="text-xs text-gray-400">暂无标签</span>
              )}
              {allTags && allTags.length > 0 && (
                <select onChange={(e) => { if (e.target.value) { assignTagMutation.mutate(e.target.value); e.target.value = ''; } }} className="rounded-lg border border-dashed border-surface-3 bg-transparent px-2 py-1 text-xs text-gray-500 hover:border-brand-300 focus:outline-none dark:border-gray-600 dark:text-gray-400" defaultValue="">
                  <option value="" disabled>+ 添加标签</option>
                  {allTags.filter((t) => !data.tags?.some((dt) => dt.id === t.id)).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>
      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-surface-0 p-6 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">合并到...</h3>
            <p className="mt-1 text-xs text-gray-500">搜索目标反馈，当前反馈将被合并到选中的反馈中</p>
            <input
              value={mergeSearch}
              onChange={(e) => setMergeSearch(e.target.value)}
              placeholder="输入标题搜索..."
              className="mt-3 w-full rounded-lg border border-surface-3 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              autoFocus
            />
            {searchResults?.items && searchResults.items.length > 0 && (
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-surface-3">
                {searchResults.items.filter((f) => f.id !== id).map((f) => (
                  <li key={f.id}>
                    <button
                      onClick={() => mergeMutation.mutate(f.id)}
                      disabled={mergeMutation.isPending}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-surface-2 disabled:opacity-50"
                    >
                      <span className="font-medium text-gray-900">{f.title}</span>
                      <span className="ml-2 text-xs text-gray-400">{STATUS_LABELS[f.status] ?? f.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => { setShowMergeModal(false); setMergeSearch(''); }}
                className="rounded-lg border border-surface-3 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-surface-2"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaItem({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={clsx('mt-0.5 font-medium', className ?? 'text-gray-900')}>{value}</p>
    </div>
  );
}

const HISTORY_STATUS_LABELS: Record<string, string> = {
  open: '待处理', in_progress: '进行中', resolved: '已解决', closed: '已关闭',
};

function InternalNotesSection({ feedbackId }: { feedbackId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [noteContent, setNoteContent] = useState('');
  const [expanded, setExpanded] = useState(false);

  const { data: notes } = useQuery({
    queryKey: ['notes', feedbackId],
    queryFn: () => apiRequest<InternalNote[]>(`/org/feedback/${feedbackId}/notes`),
    enabled: expanded,
  });

  const addMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest(`/org/feedback/${feedbackId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', feedbackId] });
      setNoteContent('');
      toast.show('备注已添加');
    },
    onError: () => toast.show('添加备注失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) =>
      apiRequest(`/org/feedback/${feedbackId}/notes/${noteId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', feedbackId] });
      toast.show('备注已删除');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '删除失败', 'error'),
  });

  return (
    <div className="rounded-xl border border-surface-3 bg-surface-0 p-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-sm font-semibold text-gray-900"
      >
        内部备注
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={clsx('transition-transform', expanded && 'rotate-180')}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {expanded && (
        <div className="mt-4 space-y-3">
          {notes && notes.length > 0 ? (
            notes.map((note) => (
              <div key={note.id} className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                <p className="text-sm text-gray-700">{note.content}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    {note.member.display_name} · {formatRelativeTime(note.created_at)}
                  </p>
                  <button
                    onClick={() => deleteMutation.mutate(note.id)}
                    disabled={deleteMutation.isPending}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-400">暂无备注</p>
          )}
          <form
            onSubmit={(e) => { e.preventDefault(); if (noteContent.trim()) addMutation.mutate(noteContent.trim()); }}
            className="flex gap-2"
          >
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="添加内部备注..."
              rows={2}
              className="flex-1 rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <button
              type="submit"
              disabled={!noteContent.trim() || addMutation.isPending}
              className="self-end rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              添加
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function StatusHistorySection({ feedbackId }: { feedbackId: string }) {
  const { data: history } = useQuery({
    queryKey: ['status-history', feedbackId],
    queryFn: () => apiRequest<StatusHistoryItem[]>(`/admin/feedback/${feedbackId}/history`),
  });

  if (!history || history.length === 0) return null;

  return (
    <div className="rounded-xl border border-surface-3 bg-surface-0 p-5">
      <h2 className="mb-4 text-sm font-semibold text-gray-900">状态变更记录</h2>
      <div className="relative space-y-3 pl-4">
        <div className="absolute bottom-2 left-[7px] top-2 w-px bg-surface-3" />
        {history.map((item) => (
          <div key={item.id} className="relative">
            <div className="absolute -left-4 top-2 h-2 w-2 rounded-full bg-brand-400" />
            <div className="ml-2 text-sm">
              <span className="text-gray-500">
                {HISTORY_STATUS_LABELS[item.old_status] ?? item.old_status}
              </span>
              <span className="mx-1.5 text-gray-400">→</span>
              <span className="font-medium text-gray-700">
                {HISTORY_STATUS_LABELS[item.new_status] ?? item.new_status}
              </span>
              <span className="ml-2 text-xs text-gray-400">
                {item.member?.display_name ?? '系统'} · {formatRelativeTime(item.created_at)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-20" />
      <div className="rounded-xl border border-surface-3 bg-surface-0 p-6">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="mt-3 h-4 w-1/3" />
        <Skeleton className="mt-6 h-20 w-full" variant="rectangular" />
      </div>
    </div>
  );
}
