import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { apiRequest, assignFeedback, fetchOrgMembers, fetchOrgTags } from '@/api/client';
import { StatusBadge } from '@/components/StatusBadge';
import { CategoryBadge, PriorityBadge, SourceBadge } from '@/components/badges';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, EmptyState, Skeleton } from '@/components/ui';
import { MergeDialog } from '@/components/feedback/MergeDialog';
import { LinkedChangelog } from '@/components/feedback/LinkedChangelog';
import { EditFeedback } from '@/components/feedback/EditFeedback';
import { InternalNotes } from '@/components/feedback/InternalNotes';
import { StatusHistory } from '@/components/feedback/StatusHistory';
import { useToast } from '@/components/Toast';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import { STATUS_META, categoryColor, statusLabel } from '@/utils/labels';
import { useAuth } from '@/hooks/useAuth';
import type { FeedbackDetail as FeedbackDetailType, FeedbackStatus } from '@/types';
const STATUS_TRANSITIONS: Record<string, FeedbackStatus[]> = {
  open: ['in_progress', 'closed'],
  in_progress: ['resolved', 'closed'],
  resolved: ['in_progress', 'closed'],
  closed: [],
};

export function FeedbackDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation('detail');
  const toast = useToast();
  const { member } = useAuth();
  const canAssign = member?.role === 'owner' || member?.role === 'admin';
  const canEdit = member?.role === 'owner' || member?.role === 'admin';
  const [replyContent, setReplyContent] = useState('');
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['feedback', id],
    queryFn: () => apiRequest<FeedbackDetailType>(`/admin/feedback/${id}`),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: FeedbackStatus) =>
      apiRequest(`/admin/feedback/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_data, status) => {
      queryClient.invalidateQueries({ queryKey: ['feedback', id] });
      toast.show(
        t('toasts.statusUpdated', { status: statusLabel(status, i18n.language) }),
      );
    },
    onError: () => toast.show(t('toasts.statusUpdateFailed'), 'error'),
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
      toast.show(t('toasts.replySent'));
    },
    onError: () => toast.show(t('toasts.replyFailed'), 'error'),
  });

  const { data: members } = useQuery({ queryKey: ['org-members'], queryFn: fetchOrgMembers });

  const assignMutation = useMutation({
    mutationFn: (assigneeId: string | null) => assignFeedback(id!, assigneeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback', id] });
      toast.show(t('toasts.assigneeUpdated'));
    },
    onError: () => toast.show(t('toasts.assignFailed'), 'error'),
  });

  const { data: allTags } = useQuery({
    queryKey: ['org-tags'],
    queryFn: fetchOrgTags,
  });

  const assignTagMutation = useMutation({
    mutationFn: (tagId: string) =>
      apiRequest(`/org/feedback/${id}/tags`, {
        method: 'POST',
        body: JSON.stringify({ tag_id: tagId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback', id] });
      toast.show(t('toasts.tagAdded'));
    },
    onError: (err) =>
      toast.show(err instanceof Error ? err.message : t('toasts.tagAddFailed'), 'error'),
  });

  const removeTagMutation = useMutation({
    mutationFn: (tagId: string) =>
      apiRequest(`/org/feedback/${id}/tags/${tagId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback', id] });
      toast.show(t('toasts.tagRemoved'));
    },
    onError: (err) =>
      toast.show(err instanceof Error ? err.message : t('toasts.tagRemoveFailed'), 'error'),
  });

  if (isLoading) return <DetailSkeleton />;
  if (!data) {
    return (
      <EmptyState
        title={t('empty.notFoundTitle')}
        description={t('empty.notFoundDescription')}
        action={{ label: t('header.backToList'), onClick: () => navigate('/feedback') }}
      />
    );
  }

  const allowedTransitions = STATUS_TRANSITIONS[data.status] ?? [];
  const currentMeta = STATUS_META[data.status as FeedbackStatus];
  const merged = data.merged_into_id && data.merged_into;
  const availableTags = (allTags ?? []).filter(
    (tag) => !data.tags?.some((dt) => dt.id === tag.id),
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.show(t('toasts.linkCopied'));
    } catch {
      toast.show(t('toasts.copyFailed'), 'error');
    }
  };

  const sendReply = () => {
    if (replyContent.trim()) replyMutation.mutate(replyContent.trim());
  };

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        title={data.title}
        eyebrow={t('header.eyebrow', { project: data.project.name })}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <CategoryBadge category={data.category} />
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <PriorityBadge priority={data.priority} />
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <SourceBadge source={data.source} />
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span>{formatRelativeTime(data.created_at)}</span>
          </span>
        }
        backTo={{ label: t('header.backToList'), onClick: () => navigate('/feedback') }}
        actions={
          <>
            {canEdit && (
              <Button variant="secondary" size="sm" onClick={() => setShowEditModal(true)}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M11.2 2.8 13.2 4.8 5.6 12.4 3 13l.6-2.6 7.6-7.6Z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                </svg>
                {t('header.edit')}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={copyLink}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 8.5a2.5 2.5 0 0 1 3.5-.3l1.8 1.8a2.5 2.5 0 0 1-3.5 3.5l-.9-.9M10 7.5a2.5 2.5 0 0 0-3.5.3L4.7 9.6a2.5 2.5 0 0 0 3.5 3.5l.9-.9"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              {t('header.copyLink')}
            </Button>
            <StatusBadge status={data.status} />
          </>
        }
      />

      {merged && (
        <div className="flex items-start gap-2.5 rounded-xl border border-accent-200 bg-accent-50/70 px-4 py-3 text-[13px] text-accent-700 dark:border-accent-500/25 dark:bg-accent-500/10 dark:text-accent-300">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0">
            <path d="M8 2v12M4.5 5.5 8 2l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>
            {t('merged.prefix')}{' '}
            <Link
              to={`/feedback/${data.merged_into!.id}`}
              className="font-semibold underline decoration-accent-300 underline-offset-2 hover:no-underline"
            >
              {data.merged_into!.title}
            </Link>
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-5">
        {/* Main column */}
        <div className="space-y-4 lg:col-start-1 lg:row-start-1">
          <Card>
            <div className="px-5 pb-4 pt-5">
              <p className="whitespace-pre-wrap text-[14px] leading-7 text-gray-700 dark:text-gray-200">
                {data.content}
              </p>
            </div>
            {(data.contact || data.app_version) && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-surface-2 px-5 py-3 text-xs text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
                {data.contact && (
                  <span>
                    {t('meta.contact')}
                    <span className="font-medium text-gray-700 dark:text-gray-200">{data.contact}</span>
                  </span>
                )}
                {data.app_version && (
                  <span>
                    {t('meta.version')}
                    <span className="font-mono text-gray-700 dark:text-gray-200">v{data.app_version}</span>
                  </span>
                )}
                <span className="ml-auto inline-flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: categoryColor(data.category) }}
                  />
                  {data.project.name}
                </span>
              </div>
            )}
          </Card>

          {data.attachments.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t('attachments.title')}{' '}
                <span className="text-gray-400">({data.attachments.length})</span>
              </h2>
              <div className="flex flex-wrap gap-3">
                {data.attachments.map((attachment) => {
                  const fileUrl = `/api/v1/upload/files/${attachment.id}`;
                  const isImage = /^image\/(png|jpe?g|gif|webp)$/i.test(attachment.mime_type);
                  return isImage ? (
                    <a
                      key={attachment.id}
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block overflow-hidden rounded-lg border border-surface-3 bg-surface-1 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card dark:border-gray-700 dark:bg-gray-900"
                    >
                      <img
                        src={fileUrl}
                        alt={attachment.filename}
                        className="max-h-[180px] w-auto object-contain"
                      />
                      <div className="border-t border-surface-3 px-2.5 py-1.5 text-[11px] text-gray-500 group-hover:text-brand-600 dark:border-gray-700 dark:text-gray-400">
                        {attachment.filename} · {(attachment.size / 1024).toFixed(0)} KB
                      </div>
                    </a>
                  ) : (
                    <a
                      key={attachment.id}
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-surface-3 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-brand-600/10"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 1h5l4 4v8H3V1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                        <path d="M8 1v4h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {attachment.filename} · {(attachment.size / 1024).toFixed(0)} KB
                    </a>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Conversation */}
          <Card>
            <div className="flex items-center justify-between border-b border-surface-2 px-5 py-4 dark:border-gray-700/60">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t('replies.title')}{' '}
                <span className="font-normal text-gray-400">({data.replies.length})</span>
              </h2>
            </div>
            <div className="px-5 py-4">
              {data.replies.length > 0 ? (
                <ol className="space-y-4">
                  {data.replies.map((reply) => (
                    <li key={reply.id} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[11px] font-semibold text-white">
                        {(reply.member?.display_name || t('replies.systemChar')).slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200">
                            {reply.member?.display_name || t('replies.system')}
                          </span>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500">
                            {formatRelativeTime(reply.created_at)}
                          </span>
                        </div>
                        <div className="mt-1.5 rounded-xl rounded-tl-sm bg-surface-1 px-3.5 py-2.5 text-[13px] leading-relaxed text-gray-700 dark:bg-gray-700/50 dark:text-gray-200">
                          <p className="whitespace-pre-wrap">{reply.content}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-6 text-center text-[13px] text-gray-400 dark:text-gray-500">
                  {t('replies.empty')}
                </p>
              )}

              {data.status !== 'closed' ? (
                <div className="mt-4 rounded-xl border border-surface-3 bg-surface-1/50 p-3 dark:border-gray-700/60 dark:bg-gray-900/30">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                    placeholder={t('replies.placeholder')}
                    rows={3}
                    className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-gray-800 placeholder:text-gray-400 focus:outline-none dark:text-gray-100"
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                      {t('replies.notifyVoters')}
                    </span>
                    <Button
                      size="sm"
                      onClick={sendReply}
                      disabled={!replyContent.trim() || replyMutation.isPending}
                    >
                      {replyMutation.isPending ? t('replies.sending') : t('replies.send')}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-lg bg-surface-1 px-3 py-2 text-center text-xs text-gray-400 dark:bg-gray-900/30 dark:text-gray-500">
                  {t('replies.closedNotice')}
                </p>
              )}
            </div>
          </Card>

          <InternalNotes feedbackId={id!} />
          <StatusHistory feedbackId={id!} />
        </div>

        {/* Sidebar */}
        <aside className="order-first space-y-4 lg:order-none lg:col-start-2 lg:row-start-1 lg:sticky lg:top-4 lg:h-fit">
          <Card className="p-4">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500">
              {t('sidebar.statusTitle')}
            </h3>
            <div className="mb-3 flex items-center justify-between rounded-lg bg-surface-1 px-3 py-2 dark:bg-gray-900/40">
              <span className="flex items-center gap-2 text-[13px] font-medium text-gray-700 dark:text-gray-200">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: currentMeta?.dot }}
                />
                {statusLabel(data.status as FeedbackStatus, i18n.language)}
              </span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                {t('sidebar.current')}
              </span>
            </div>
            {allowedTransitions.length > 0 && (
              <div className="space-y-1.5">
                {allowedTransitions.map((status) => {
                  const meta = STATUS_META[status];
                  return (
                    <button
                      key={status}
                      onClick={() => statusMutation.mutate(status)}
                      disabled={statusMutation.isPending}
                      className={clsx(
                        'flex w-full items-center gap-2 rounded-lg border border-surface-3 px-3 py-2 text-[13px] font-medium text-gray-600 transition-all',
                        'hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700',
                        'disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:border-brand-500/40 dark:hover:bg-brand-600/10 dark:hover:text-brand-300',
                      )}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: meta?.dot }}
                      />
                      {t('sidebar.markAs', {
                        status: statusLabel(status, i18n.language),
                      })}
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="ml-auto">
                        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            )}
            {!merged && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-2 w-full"
                onClick={() => setShowMergeModal(true)}
              >
                {t('sidebar.mergeInto')}
              </Button>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500">
              {t('sidebar.assigneeTitle')}
            </h3>
            {canAssign ? (
              <select
                value={data.assignee_id ?? ''}
                onChange={(e) => assignMutation.mutate(e.target.value || null)}
                disabled={assignMutation.isPending}
                className="h-9 w-full rounded-lg border border-surface-3 bg-surface-0 px-2.5 text-[13px] text-gray-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200"
              >
                <option value="">{t('sidebar.unassigned')}</option>
                {(Array.isArray(members) ? members : []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            ) : data.assignee ? (
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 dark:bg-brand-600/20 dark:text-brand-300">
                  {data.assignee.display_name.charAt(0)}
                </span>
                <div>
                  <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200">
                    {data.assignee.display_name}
                  </p>
                  <p className="text-[11px] text-gray-400">{data.assignee.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-gray-400">{t('sidebar.unassigned')}</p>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500">
              {t('sidebar.tagsTitle')}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              {data.tags?.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-surface-3 bg-surface-1/60 px-2 py-1 text-[11px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: tag.color ?? '#6b7280' }}
                  />
                  {tag.name}
                  <button
                    onClick={() => removeTagMutation.mutate(tag.id)}
                    disabled={removeTagMutation.isPending}
                    className="text-gray-400 transition-colors hover:text-rose-500"
                    aria-label={t('sidebar.removeTag', { name: tag.name })}
                  >
                    ×
                  </button>
                </span>
              ))}
              {(!data.tags || data.tags.length === 0) && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {t('sidebar.noTags')}
                </span>
              )}
            </div>
            {availableTags.length > 0 && (
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    assignTagMutation.mutate(e.target.value);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
                className="mt-2.5 h-8 w-full rounded-lg border border-dashed border-surface-3 bg-transparent px-2 text-xs text-gray-500 transition-colors hover:border-brand-300 focus:outline-none dark:border-gray-600 dark:text-gray-400"
              >
                <option value="" disabled>
                  {t('sidebar.addTag')}
                </option>
                {availableTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            )}
          </Card>

          <LinkedChangelog feedbackId={data.id} projectId={data.project.id} />
        </aside>
      </div>

      {showEditModal && (
        <EditFeedback feedback={data} onClose={() => setShowEditModal(false)} />
      )}

      {showMergeModal && (
        <MergeDialog
          feedbackId={id!}
          onClose={() => setShowMergeModal(false)}
          onMerged={(targetId) => {
            setShowMergeModal(false);
            navigate(`/feedback/${targetId}`);
          }}
        />
      )}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-5">
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
