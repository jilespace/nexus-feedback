import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { apiRequest } from '@/api/client';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, EmptyState, Skeleton } from '@/components/ui';
import { formatDateTime } from '@/utils/markdown';

type NotificationPref = {
  id: string;
  email: string;
  project_id: string;
  status_updates: boolean;
  weekly_digest: boolean;
  created_at: string;
};

type PrefField = 'status_updates' | 'weekly_digest';

const dangerActionClass =
  'inline-flex h-8 items-center rounded-md px-2 text-[11px] font-medium text-gray-500 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-rose-500/10 dark:hover:text-rose-400';

const COLUMNS = 'sm:grid-cols-[minmax(0,1fr)_150px_136px_60px]';

export function Notifications() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { show: toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState<NotificationPref | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['notification-preferences', projectId],
    queryFn: () =>
      apiRequest<{ items: NotificationPref[]; total: number }>(
        `/org/projects/${projectId}/notifications?page_size=100`,
      ),
    enabled: !!projectId,
  });

  const updateMutation = useMutation({
    mutationFn: (params: { email: string; data: Partial<NotificationPref> }) =>
      apiRequest(`/org/projects/${projectId}/notifications/${encodeURIComponent(params.email)}`, {
        method: 'PUT',
        body: JSON.stringify(params.data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', projectId] });
      toast('偏好已更新');
    },
    onError: (err) => toast(err instanceof Error ? err.message : '更新失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (email: string) =>
      apiRequest(`/org/projects/${projectId}/notifications/${encodeURIComponent(email)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', projectId] });
      setConfirmDelete(null);
      toast('已移除该通知偏好');
    },
    onError: (err) => {
      setConfirmDelete(null);
      toast(err instanceof Error ? err.message : '删除失败', 'error');
    },
  });

  const preferences = data?.items ?? [];
  const pendingUpdate = updateMutation.isPending ? updateMutation.variables : undefined;

  function isRowPending(email: string) {
    return pendingUpdate?.email === email;
  }

  function togglePreference(pref: NotificationPref, field: PrefField) {
    updateMutation.mutate({ email: pref.email, data: { [field]: !pref[field] } });
  }

  const backToSettings = () => navigate(`/projects/${projectId}/settings`);

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="通知偏好"
        description="管理订阅此项目通知的用户邮箱及其偏好；用户投票或提交反馈时会自动创建记录。"
        actions={
          projectId ? (
            <Button variant="secondary" onClick={backToSettings}>
              返回项目设置
            </Button>
          ) : undefined
        }
      />

      {!projectId ? (
        <Card>
          <EmptyState
            title="请先选择一个项目"
            description="从项目列表进入项目后，即可在这里管理通知订阅。"
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-2 px-4 py-3.5 dark:border-gray-700/60 sm:px-5">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                订阅者
                <span className="ml-1.5 font-normal tabular-nums text-gray-400">
                  ({data?.total ?? preferences.length})
                </span>
              </h2>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                状态更新：反馈状态变化时发送邮件；周报：每周汇总此项目的反馈动态。
              </p>
            </div>
          </div>

          {isError ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">通知偏好加载失败</p>
              <p className="max-w-sm text-xs leading-relaxed text-gray-400 dark:text-gray-500">
                {error instanceof Error ? error.message : '请检查网络后重试'}
              </p>
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                重试
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : preferences.length === 0 ? (
            <EmptyState
              title="暂无通知偏好记录"
              description="当用户投票或提交反馈后，其通知偏好会自动创建，并可以在这里管理。"
              action={{ label: '返回项目设置', onClick: backToSettings }}
            />
          ) : (
            <>
              <div
                className={clsx(
                  'hidden items-center gap-4 border-b border-surface-2 bg-surface-1/50 px-5 py-2 dark:border-gray-700/60 dark:bg-gray-900/30 sm:grid',
                  COLUMNS,
                )}
              >
                {['邮箱', '状态更新', '周报', '操作'].map((label) => (
                  <span
                    key={label}
                    className={clsx(
                      'text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500',
                      label === '操作' && 'text-right',
                    )}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <ul className="divide-y divide-surface-2 dark:divide-gray-700/60">
                {preferences.map((pref) => {
                  const rowPending = isRowPending(pref.email);
                  return (
                    <li
                      key={pref.id}
                      className={clsx(
                        'flex min-h-[52px] flex-col gap-2.5 px-4 py-3 transition-colors hover:bg-surface-1/60 dark:hover:bg-gray-700/20 sm:grid sm:items-center sm:gap-4 sm:px-5 sm:py-2',
                        COLUMNS,
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-3 sm:block">
                          <p className="truncate font-mono text-[12.5px] text-gray-800 dark:text-gray-200">
                            {pref.email}
                          </p>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(pref)}
                            className={clsx(dangerActionClass, 'sm:hidden')}
                          >
                            移除
                          </button>
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                          加入于 {formatDateTime(pref.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-5 sm:contents">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="w-14 shrink-0 text-[11px] text-gray-400 dark:text-gray-500 sm:hidden">
                            状态更新
                          </span>
                          <Switch
                            checked={pref.status_updates}
                            disabled={rowPending}
                            label={`状态更新通知：${pref.email}`}
                            onChange={() => togglePreference(pref, 'status_updates')}
                          />
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            {pref.status_updates ? '已开启' : '已关闭'}
                          </span>
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="w-14 shrink-0 text-[11px] text-gray-400 dark:text-gray-500 sm:hidden">
                            周报
                          </span>
                          <Switch
                            checked={pref.weekly_digest}
                            disabled={rowPending}
                            label={`每周汇总邮件：${pref.email}`}
                            onChange={() => togglePreference(pref, 'weekly_digest')}
                          />
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            {pref.weekly_digest ? '已开启' : '已关闭'}
                          </span>
                        </div>
                      </div>

                      <div className="hidden sm:flex sm:justify-end">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(pref)}
                          className={dangerActionClass}
                        >
                          移除
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      )}

      {confirmDelete && (
        <Modal
          title="移除通知偏好"
          description={confirmDelete.email}
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
                onClick={() => deleteMutation.mutate(confirmDelete.email)}
              >
                {deleteMutation.isPending ? '移除中…' : '确认移除'}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            移除后该邮箱将不再收到此项目的通知；若用户再次投票或提交反馈，偏好记录会重新创建。
          </p>
        </Modal>
      )}
    </div>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={clsx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 dark:focus-visible:ring-offset-gray-800',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-brand-600' : 'bg-surface-3 dark:bg-gray-600',
      )}
    >
      <span
        className={clsx(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-150',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
