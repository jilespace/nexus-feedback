import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { clsx } from 'clsx';
import { apiRequest } from '@/api/client';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { PageHeader } from '@/components/PageHeader';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Skeleton,
  Switch,
  settingsInputClass,
} from '@/components/ui';
import { formatDateTime } from '@/utils/markdown';
import type { PaginatedResponse, Webhook, WebhookLog } from '@/types';

/** Event values are the server contract; labels come from `config:webhooks.events.*`. */
const AVAILABLE_EVENTS: Array<{ value: string; key: string }> = [
  { value: 'feedback.created', key: 'webhooks.events.feedback_created' },
  { value: 'feedback.status_changed', key: 'webhooks.events.feedback_status_changed' },
  { value: 'feedback.assigned', key: 'webhooks.events.feedback_assigned' },
  { value: 'feedback.merged', key: 'webhooks.events.feedback_merged' },
  { value: 'comment.created', key: 'webhooks.events.comment_created' },
];

function eventLabel(value: string, t: TFunction<'config'>): string {
  const event = AVAILABLE_EVENTS.find((item) => item.value === value);
  return event ? t(event.key) : value;
}

const dangerActionClass =
  'inline-flex h-8 items-center rounded-md px-2 text-[11px] font-medium text-gray-500 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-rose-500/10 dark:hover:text-rose-400';

type TestResult = { ok: boolean; message?: string };

export function Webhooks() {
  const { t } = useTranslation('config');
  const { projectId = '' } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const { show: toast } = useToast();
  const [editing, setEditing] = useState<Webhook | 'new' | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Webhook | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['webhooks', projectId] });

  const {
    data: webhooksPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['webhooks', projectId],
    queryFn: () =>
      apiRequest<PaginatedResponse<Webhook>>(`/org/projects/${projectId}/webhooks`),
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { url: string; events: string[]; secret?: string }) =>
      apiRequest(`/org/projects/${projectId}/webhooks`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast(t('webhooks.createToast'));
    },
    onError: (err) =>
      toast(err instanceof Error ? err.message : t('webhooks.createFailed'), 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, url, events }: { id: string; url: string; events: string[] }) =>
      apiRequest(`/org/projects/${projectId}/webhooks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ url, events }),
      }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast(t('webhooks.updateToast'));
    },
    onError: (err) =>
      toast(err instanceof Error ? err.message : t('webhooks.updateFailed'), 'error'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest(`/org/projects/${projectId}/webhooks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }),
    onSuccess: (_, variables) => {
      invalidate();
      toast(variables.active ? t('webhooks.toggleEnabledToast') : t('webhooks.toggleDisabledToast'));
    },
    onError: (err) =>
      toast(err instanceof Error ? err.message : t('webhooks.toggleFailed'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/org/projects/${projectId}/webhooks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      setConfirmDelete(null);
      toast(t('webhooks.deleteToast'));
    },
    onError: (err) => {
      setConfirmDelete(null);
      toast(err instanceof Error ? err.message : t('common.deleteFailed'), 'error');
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ ok: boolean }>(`/org/projects/${projectId}/webhooks/${id}/test`, {
        method: 'POST',
      }),
    onSuccess: (data, id) => {
      setTestResults((prev) => ({ ...prev, [id]: { ok: data.ok } }));
    },
    onError: (err, id) => {
      const message = err instanceof Error ? err.message : t('webhooks.testErrorFallback');
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, message } }));
      toast(message, 'error');
    },
  });

  const list = webhooksPage?.items ?? [];

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title={t('webhooks.title')}
        description={t('webhooks.description')}
        actions={
          projectId ? (
            <Button onClick={() => setEditing('new')}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              {t('webhooks.addButton')}
            </Button>
          ) : undefined
        }
      />

      {!projectId ? (
        <Card>
          <EmptyState
            title={t('common.selectProjectTitle')}
            description={t('common.selectProjectWebhooks')}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-2 px-4 py-3.5 dark:border-gray-700/60 sm:px-5">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t('webhooks.listTitle')}
                <span className="ml-1.5 font-normal tabular-nums text-gray-400">
                  ({webhooksPage?.total ?? list.length})
                </span>
              </h2>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                {t('webhooks.listDescription')}
              </p>
            </div>
          </div>

          {isError ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('webhooks.loadErrorTitle')}
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
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              title={t('webhooks.emptyTitle')}
              description={t('webhooks.emptyDescription')}
              action={{ label: t('webhooks.addButton'), onClick: () => setEditing('new') }}
            />
          ) : (
            <ul className="divide-y divide-surface-2 dark:divide-gray-700/60">
              {list.map((webhook) => {
                const result = testResults[webhook.id];
                const testing = testMutation.isPending && testMutation.variables === webhook.id;
                const toggling =
                  toggleMutation.isPending && toggleMutation.variables?.id === webhook.id;
                const expanded = expandedId === webhook.id;
                return (
                  <li
                    key={webhook.id}
                    className="px-4 py-3.5 transition-colors hover:bg-surface-1/40 dark:hover:bg-gray-700/10 sm:px-5"
                  >
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={webhook.active ? 'green' : 'gray'}>
                            <span
                              className={clsx(
                                'h-1.5 w-1.5 rounded-full',
                                webhook.active ? 'bg-emerald-500' : 'bg-gray-400',
                              )}
                              aria-hidden="true"
                            />
                            {webhook.active ? t('webhooks.active') : t('webhooks.inactive')}
                          </Badge>
                          <span
                            className="truncate font-mono text-[12.5px] font-medium text-gray-800 dark:text-gray-200"
                            title={webhook.url}
                          >
                            {webhook.url}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {webhook.events.map((event) => (
                            <span
                              key={event}
                              className="inline-flex h-[22px] items-center rounded-md bg-surface-2 px-2 text-[11px] font-medium text-gray-500 ring-1 ring-inset ring-surface-3 dark:bg-gray-700/50 dark:text-gray-300 dark:ring-gray-600/60"
                            >
                              {eventLabel(event, t)}
                            </span>
                          ))}
                          <span className="font-mono text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                            {t('webhooks.createdAt', { time: formatDateTime(webhook.created_at) })}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 xl:shrink-0">
                        <div className="flex h-8 items-center rounded-lg border border-surface-3 bg-surface-0 px-2 dark:border-gray-700 dark:bg-gray-800">
                          <Switch
                            checked={webhook.active}
                            disabled={toggling}
                            label={
                              webhook.active
                                ? t('webhooks.switch.disableLabel')
                                : t('webhooks.switch.enableLabel')
                            }
                            showState
                            stateLabels={[
                              t('webhooks.switch.enabled'),
                              t('webhooks.switch.disabled'),
                            ]}
                            onChange={(next) =>
                              toggleMutation.mutate({ id: webhook.id, active: next })
                            }
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={testing}
                            onClick={() => testMutation.mutate(webhook.id)}
                          >
                            {testing ? t('webhooks.testing') : t('webhooks.test')}
                          </Button>
                          {result && (
                            <>
                              <Badge tone={result.ok ? 'green' : 'red'}>
                                {result.ok ? t('webhooks.testSuccess') : t('webhooks.testFailed')}
                              </Badge>
                              {result.message && (
                                <span
                                  className="max-w-[220px] truncate font-mono text-[11px] text-rose-600 dark:text-rose-400"
                                  title={result.message}
                                >
                                  {result.message}
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing(webhook)}
                        >
                          {t('webhooks.edit')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedId(expanded ? null : webhook.id)}
                        >
                          {expanded ? t('webhooks.hideLogs') : t('webhooks.viewLogs')}
                        </Button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(webhook)}
                          className={dangerActionClass}
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-3 rounded-lg border border-surface-3 bg-surface-1/40 dark:border-gray-700 dark:bg-gray-900/30">
                        <WebhookLogList projectId={projectId} webhookId={webhook.id} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {editing !== null && (
        <WebhookFormModal
          webhook={editing === 'new' ? null : editing}
          isPending={createMutation.isPending || updateMutation.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(data) => {
            if (editing === 'new') {
              createMutation.mutate(data);
            } else {
              updateMutation.mutate({ id: editing.id, url: data.url, events: data.events });
            }
          }}
        />
      )}

      {confirmDelete && (
        <Modal
          title={t('webhooks.deleteModalTitle')}
          description={confirmDelete.url}
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
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
              >
                {deleteMutation.isPending ? t('common.deleting') : t('common.confirmDelete')}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {t('webhooks.deleteModalBody')}
          </p>
        </Modal>
      )}
    </div>
  );
}

function WebhookFormModal({
  webhook,
  isPending,
  onClose,
  onSubmit,
}: {
  webhook: Webhook | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (data: { url: string; events: string[]; secret?: string }) => void;
}) {
  const { t } = useTranslation('config');
  const isEdit = webhook !== null;
  const [url, setUrl] = useState(webhook?.url ?? '');
  const [events, setEvents] = useState<string[]>(webhook?.events ?? []);
  const [secret, setSecret] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);

  function toggleEvent(event: string) {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((item) => item !== event) : [...prev, event],
    );
    if (eventsError) setEventsError(null);
  }

  function submit() {
    const trimmed = url.trim();
    let invalid = false;
    if (!trimmed) {
      setUrlError(t('webhooks.form.urlErrorRequired'));
      invalid = true;
    } else if (!/^https?:\/\/[^\s]+$/i.test(trimmed)) {
      setUrlError(t('webhooks.form.urlErrorInvalid'));
      invalid = true;
    } else {
      setUrlError(null);
    }
    if (events.length === 0) {
      setEventsError(t('webhooks.form.eventsError'));
      invalid = true;
    } else {
      setEventsError(null);
    }
    if (invalid) return;
    onSubmit({ url: trimmed, events, secret: secret.trim() || undefined });
  }

  return (
    <Modal
      title={isEdit ? t('webhooks.form.editTitle') : t('webhooks.form.addTitle')}
      description={t('webhooks.form.description')}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="webhook-form" size="sm" disabled={isPending}>
            {isPending
              ? t('webhooks.form.saving')
              : isEdit
                ? t('webhooks.form.saveButton')
                : t('webhooks.form.createButton')}
          </Button>
        </>
      }
    >
      <form
        id="webhook-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <Field
          label={t('webhooks.form.urlLabel')}
          htmlFor="webhook-url"
          error={urlError ?? undefined}
          hint={t('webhooks.form.urlHint')}
        >
          <input
            id="webhook-url"
            type="url"
            value={url}
            autoFocus
            onChange={(event) => {
              setUrl(event.target.value);
              if (urlError) setUrlError(null);
            }}
            placeholder="https://example.com/webhooks/nexus"
            required
            className={clsx(settingsInputClass(!!urlError), 'font-mono text-[12.5px]')}
          />
        </Field>

        <Field label={t('webhooks.form.eventsLabel')} error={eventsError ?? undefined}>
          <div className="grid gap-2 sm:grid-cols-2">
            {AVAILABLE_EVENTS.map((event) => {
              const checked = events.includes(event.value);
              return (
                <button
                  key={event.value}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => toggleEvent(event.value)}
                  className={clsx(
                    'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
                    checked
                      ? 'border-brand-300 bg-brand-50/70 dark:border-brand-500/40 dark:bg-brand-600/15'
                      : 'border-surface-3 bg-surface-0 hover:border-gray-300 hover:bg-surface-1 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 dark:hover:bg-gray-700/50',
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                      checked
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-gray-300 bg-surface-0 dark:border-gray-600 dark:bg-gray-900',
                    )}
                    aria-hidden="true"
                  >
                    {checked && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path
                          d="m2 5.2 2 2 4-4.4"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={clsx(
                        'block text-[12.5px] font-medium',
                        checked
                          ? 'text-brand-700 dark:text-brand-300'
                          : 'text-gray-700 dark:text-gray-200',
                      )}
                    >
                      {t(event.key)}
                    </span>
                    <span className="block truncate font-mono text-[10.5px] text-gray-400 dark:text-gray-500">
                      {event.value}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

        {!isEdit && (
          <Field
            label={t('webhooks.form.secretLabel')}
            htmlFor="webhook-secret"
            hint={t('webhooks.form.secretHint')}
          >
            <input
              id="webhook-secret"
              type="text"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder={t('webhooks.form.secretPlaceholder')}
              className={clsx(settingsInputClass(), 'font-mono text-[12.5px]')}
            />
          </Field>
        )}
      </form>
    </Modal>
  );
}

function WebhookLogList({ projectId, webhookId }: { projectId: string; webhookId: string }) {
  const { t } = useTranslation('config');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['webhook-logs', webhookId, page],
    queryFn: () =>
      apiRequest<PaginatedResponse<WebhookLog>>(
        `/org/projects/${projectId}/webhooks/${webhookId}/logs?page=${page}&page_size=8`,
      ),
    enabled: !!webhookId,
  });

  const logs = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.page_size ?? 8;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="flex items-center justify-between border-b border-surface-2 px-3 py-2 dark:border-gray-700/60">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">
          {t('webhooks.logs.title')}
        </span>
        {total > 0 && (
          <span className="font-mono text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
            {t('webhooks.logs.total', { count: total })}
          </span>
        )}
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('webhooks.logs.loadErrorTitle')}
          </p>
          <p className="max-w-sm text-[11px] text-gray-400 dark:text-gray-500">
            {error instanceof Error ? error.message : t('webhooks.logs.loadErrorFallback')}
          </p>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-1.5 p-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('webhooks.logs.emptyTitle')}
          </p>
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            {t('webhooks.logs.emptyDescription')}
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-surface-2/70 dark:divide-gray-700/50">
            {logs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <Badge tone={log.success ? 'green' : 'red'} className="h-[22px]">
                  {log.success ? t('webhooks.logs.success') : t('webhooks.logs.failure')}
                </Badge>
                <span className="min-w-0 max-w-full flex-1 basis-40 truncate font-mono text-[11px] text-gray-700 dark:text-gray-300">
                  {eventLabel(log.event, t)}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                  {log.status_code !== null ? `HTTP ${log.status_code}` : 'HTTP —'}
                </span>
                {log.attempts > 1 && (
                  <span className="font-mono text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                    {t('webhooks.logs.attempts', { count: log.attempts })}
                  </span>
                )}
                <span className="w-full font-mono text-[11px] tabular-nums text-gray-400 dark:text-gray-500 sm:w-auto">
                  {formatDateTime(log.created_at)}
                </span>
                {log.error && (
                  <p className="w-full break-all font-mono text-[11px] leading-relaxed text-rose-600 dark:text-rose-400">
                    {log.error}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 border-t border-surface-2 px-3 py-2 dark:border-gray-700/60">
              <Button
                size="sm"
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                {t('webhooks.logs.previousPage')}
              </Button>
              <span className="font-mono text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                {t('webhooks.logs.nextPage')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
