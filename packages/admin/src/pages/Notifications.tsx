import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { apiRequest } from '@/api/client';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, EmptyState, Skeleton, Switch } from '@/components/ui';
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
  const { t } = useTranslation('config');
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
      toast(t('notifications.updateToast'));
    },
    onError: (err) =>
      toast(err instanceof Error ? err.message : t('notifications.updateFailed'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (email: string) =>
      apiRequest(`/org/projects/${projectId}/notifications/${encodeURIComponent(email)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', projectId] });
      setConfirmDelete(null);
      toast(t('notifications.removedToast'));
    },
    onError: (err) => {
      setConfirmDelete(null);
      toast(err instanceof Error ? err.message : t('common.deleteFailed'), 'error');
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
  const stateLabels: [string, string] = [
    t('notifications.switch.enabled'),
    t('notifications.switch.disabled'),
  ];
  const columns = [
    { key: 'email', label: t('notifications.columns.email'), className: undefined },
    {
      key: 'statusUpdates',
      label: t('notifications.columns.statusUpdates'),
      className: undefined,
    },
    { key: 'weeklyDigest', label: t('notifications.columns.weeklyDigest'), className: undefined },
    { key: 'actions', label: t('notifications.columns.actions'), className: 'text-right' },
  ];

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title={t('notifications.title')}
        description={t('notifications.description')}
        actions={
          projectId ? (
            <Button variant="secondary" onClick={backToSettings}>
              {t('notifications.backButton')}
            </Button>
          ) : undefined
        }
      />

      {!projectId ? (
        <Card>
          <EmptyState
            title={t('common.selectProjectTitle')}
            description={t('common.selectProjectNotifications')}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-2 px-4 py-3.5 dark:border-gray-700/60 sm:px-5">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t('notifications.listTitle')}
                <span className="ml-1.5 font-normal tabular-nums text-gray-400">
                  ({data?.total ?? preferences.length})
                </span>
              </h2>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                {t('notifications.listDescription')}
              </p>
            </div>
          </div>

          {isError ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('notifications.loadErrorTitle')}
              </p>
              <p className="max-w-sm text-xs leading-relaxed text-gray-400 dark:text-gray-500">
                {error instanceof Error ? error.message : t('common.networkRetry')}
              </p>
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                {t('common.retry')}
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
              title={t('notifications.emptyTitle')}
              description={t('notifications.emptyDescription')}
              action={{ label: t('notifications.backButton'), onClick: backToSettings }}
            />
          ) : (
            <>
              <div
                className={clsx(
                  'hidden items-center gap-4 border-b border-surface-2 bg-surface-1/50 px-5 py-2 dark:border-gray-700/60 dark:bg-gray-900/30 sm:grid',
                  COLUMNS,
                )}
              >
                {columns.map((column) => (
                  <span
                    key={column.key}
                    className={clsx(
                      'text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500',
                      column.className,
                    )}
                  >
                    {column.label}
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
                            {t('notifications.remove')}
                          </button>
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                          {t('notifications.joinedAt', { time: formatDateTime(pref.created_at) })}
                        </p>
                      </div>

                      <div className="flex items-center gap-5 sm:contents">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="w-14 shrink-0 text-[11px] text-gray-400 dark:text-gray-500 sm:hidden">
                            {t('notifications.columns.statusUpdates')}
                          </span>
                          <Switch
                            checked={pref.status_updates}
                            disabled={rowPending}
                            label={t('notifications.switch.statusUpdatesLabel', {
                              email: pref.email,
                            })}
                            onChange={() => togglePreference(pref, 'status_updates')}
                            showState
                            stateLabels={stateLabels}
                          />
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="w-14 shrink-0 text-[11px] text-gray-400 dark:text-gray-500 sm:hidden">
                            {t('notifications.columns.weeklyDigest')}
                          </span>
                          <Switch
                            checked={pref.weekly_digest}
                            disabled={rowPending}
                            label={t('notifications.switch.weeklyDigestLabel', {
                              email: pref.email,
                            })}
                            onChange={() => togglePreference(pref, 'weekly_digest')}
                            showState
                            stateLabels={stateLabels}
                          />
                        </div>
                      </div>

                      <div className="hidden sm:flex sm:justify-end">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(pref)}
                          className={dangerActionClass}
                        >
                          {t('notifications.remove')}
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
          title={t('notifications.deleteModalTitle')}
          description={confirmDelete.email}
          onClose={() => setConfirmDelete(null)}
          size="sm"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDelete.email)}
              >
                {deleteMutation.isPending
                  ? t('notifications.removing')
                  : t('notifications.confirmRemove')}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {t('notifications.deleteModalBody')}
          </p>
        </Modal>
      )}
    </div>
  );
}
