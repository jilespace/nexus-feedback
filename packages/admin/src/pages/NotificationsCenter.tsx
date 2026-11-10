import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { apiRequest } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { Badge, Button, Card, CardHeader, EmptyState, Skeleton, Switch } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { Pagination } from '@/components/feedback/Pagination';
import { useToast } from '@/components/Toast';
import {
  NOTIFICATION_TYPE_FALLBACK_LABEL_KEY,
  NOTIFICATION_TYPE_LABEL_KEYS,
  TrashIcon,
} from '@/components/notifications/NotificationIcons';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import {
  NOTIFICATIONS_PAGE_SIZE,
  useClearNotifications,
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '@/hooks/useNotifications';
import type {
  NotificationItem,
  NotificationPage,
  NotificationType,
} from '@/hooks/useNotifications';
import type { ProjectAccessInfo } from '@/types';

type Filter = 'all' | 'unread';

const TYPE_FILTER_ORDER: NotificationType[] = [
  'feedback.created',
  'feedback.assigned',
  'feedback.status_changed',
  'feedback.comment',
];

const TYPE_META: Record<
  NotificationType,
  { tone: 'brand' | 'amber' | 'blue' | 'green'; dot: string }
> = {
  'feedback.created': { tone: 'brand', dot: '#3D5AFE' },
  'feedback.assigned': { tone: 'amber', dot: '#F59E0B' },
  'feedback.status_changed': { tone: 'blue', dot: '#0EA5E9' },
  'feedback.comment': { tone: 'green', dot: '#10B981' },
};

type NotificationSettings = Record<NotificationType, boolean> & {
  dnd: DndSettings;
  /** Project ids whose in-app notifications are muted. */
  mutedProjects: string[];
};

type DndSlot = {
  /** HH:mm, local time. */
  start: string;
  /** HH:mm, local time. */
  end: string;
};

type DndSettings = {
  enabled: boolean;
  /** Up to MAX_DND_SLOTS windows; any hit mutes in-app notifications. */
  slots: DndSlot[];
};

const DEFAULT_DND: DndSettings = { enabled: false, slots: [] };
const MAX_DND_SLOTS = 5;
const MAX_MUTED_PROJECTS = 50;
const DND_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_SLOT: DndSlot = { start: '22:00', end: '08:00' };

const slotIsValid = (slot: DndSlot): boolean =>
  DND_TIME_RE.test(slot.start) && DND_TIME_RE.test(slot.end) && slot.start !== slot.end;

const sameSlots = (a: DndSlot[], b: DndSlot[]): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

const timeInputClass =
  'h-9 w-28 rounded-lg border border-surface-3 bg-surface-1/60 px-2.5 font-mono text-[13px] tabular-nums text-gray-900 transition-colors focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100';

const fieldLabelClass =
  'mb-1.5 block text-[11px] font-semibold tracking-[0.04em] text-gray-500 dark:text-gray-400';

const SETTING_ROWS: Array<{
  key: NotificationType;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    key: 'feedback.created',
    labelKey: 'page.settings.rows.created.label',
    descriptionKey: 'page.settings.rows.created.description',
  },
  {
    key: 'feedback.assigned',
    labelKey: 'page.settings.rows.assigned.label',
    descriptionKey: 'page.settings.rows.assigned.description',
  },
  {
    key: 'feedback.status_changed',
    labelKey: 'page.settings.rows.statusChanged.label',
    descriptionKey: 'page.settings.rows.statusChanged.description',
  },
  {
    key: 'feedback.comment',
    labelKey: 'page.settings.rows.comment.label',
    descriptionKey: 'page.settings.rows.comment.description',
  },
];

export function NotificationsCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation('notifications');
  const [filter, setFilter] = useState<Filter>('all');
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all');
  const [page, setPage] = useState(1);
  const [confirmClear, setConfirmClear] = useState(false);
  const [dndDraft, setDndDraft] = useState<DndSettings | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications', 'page', filter, page, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(NOTIFICATIONS_PAGE_SIZE),
      });
      if (filter === 'unread') params.set('unread', 'true');
      if (typeFilter !== 'all') params.set('type', typeFilter);
      return apiRequest<NotificationPage>(`/org/notifications?${params.toString()}`);
    },
  });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();
  const clearNotifications = useClearNotifications();

  const open = (item: NotificationItem) => {
    if (!item.read_at) {
      markRead.mutate(item.id, {
        onError: () => toast.show(t('toast.markReadFailed'), 'error'),
      });
    }
    const target = item.link || (item.feedback_id ? `/feedback/${item.feedback_id}` : null);
    if (target) navigate(target);
  };

  const remove = (item: NotificationItem) => {
    deleteNotification.mutate(item.id, {
      onError: () => toast.show(t('toast.deleteFailed'), 'error'),
    });
  };

  const readAll = () => {
    markAllRead.mutate(undefined, {
      onSuccess: (result) =>
        toast.show(
          result.updated > 0
            ? t('toast.markedRead', { count: result.updated })
            : t('toast.noUnread'),
        ),
      onError: () => toast.show(t('toast.operationFailed'), 'error'),
    });
  };

  const confirmClearAll = () => {
    clearNotifications.mutate(undefined, {
      onSuccess: (result) => {
        toast.show(t('toast.cleared', { count: result.deleted }));
        setConfirmClear(false);
        setPage(1);
      },
      onError: () => toast.show(t('toast.clearFailed'), 'error'),
    });
  };

  const { data: settings } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: () => apiRequest<NotificationSettings>('/org/notifications/settings'),
  });

  const settingsMutation = useMutation({
    mutationFn: (patch: Partial<NotificationSettings>) =>
      apiRequest<NotificationSettings>('/org/notifications/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: patch }),
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(['notification-settings'], next);
    },
    onError: () => toast.show(t('toast.settingsSaveFailed'), 'error'),
  });

  const toggleSetting = (key: NotificationType, value: boolean) => {
    if (!settings) return;
    queryClient.setQueryData(['notification-settings'], { ...settings, [key]: value });
    settingsMutation.mutate({ [key]: value });
  };

  // Muted projects read from the existing org project list; unknown stored ids
  // are kept untouched but not shown (the list only covers this organization).
  const { data: orgProjects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiRequest<ProjectAccessInfo[]>('/org/projects'),
  });
  const projectOptions = orgProjects ?? [];
  const mutedProjects = settings?.mutedProjects ?? [];

  const toggleMutedProject = (projectId: string) => {
    if (!settings) return;
    const isMuted = mutedProjects.includes(projectId);
    if (!isMuted && mutedProjects.length >= MAX_MUTED_PROJECTS) return;
    const next = isMuted
      ? mutedProjects.filter((id) => id !== projectId)
      : [...mutedProjects, projectId];
    queryClient.setQueryData(['notification-settings'], { ...settings, mutedProjects: next });
    settingsMutation.mutate({ mutedProjects: next });
  };

  // DND editing is local until "save": toggling the switch, editing or adding
  // windows only changes the draft. Saving applies the same optimistic update
  // strategy used by the type switches above.
  const serverDnd = settings?.dnd ?? DEFAULT_DND;
  const dnd = dndDraft ?? serverDnd;
  const dndDirty =
    !!dndDraft &&
    (dndDraft.enabled !== serverDnd.enabled || !sameSlots(dndDraft.slots, serverDnd.slots));
  const dndRowsValid = dnd.slots.every(slotIsValid);
  const dndCanSave =
    dnd.slots.length <= MAX_DND_SLOTS && dndRowsValid && (!dnd.enabled || dnd.slots.length > 0);

  const updateDnd = (patch: Partial<DndSettings>) => {
    setDndDraft({ ...dnd, ...patch });
  };

  const updateSlot = (index: number, patch: Partial<DndSlot>) => {
    setDndDraft({
      ...dnd,
      slots: dnd.slots.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, ...patch } : slot,
      ),
    });
  };

  const addSlot = () => {
    if (dnd.slots.length >= MAX_DND_SLOTS) return;
    setDndDraft({ ...dnd, slots: [...dnd.slots, { ...DEFAULT_SLOT }] });
  };

  const removeSlot = (index: number) => {
    setDndDraft({ ...dnd, slots: dnd.slots.filter((_, slotIndex) => slotIndex !== index) });
  };

  const saveDnd = () => {
    if (!settings || !dndDirty || !dndCanSave) return;
    queryClient.setQueryData(['notification-settings'], { ...settings, dnd });
    settingsMutation.mutate(
      { dnd },
      {
        onSuccess: () => {
          setDndDraft(null);
          toast.show(t('toast.dndSaved'));
        },
      },
    );
  };

  const items = data?.items ?? [];
  const totalCount = data?.total ?? 0;
  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;
  const unreadCount = data?.unread_count ?? 0;

  const filters: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: t('page.filterAll') },
    {
      key: 'unread',
      label:
        unreadCount > 0
          ? t('page.filterUnreadCount', { count: unreadCount })
          : t('page.filterUnread'),
    },
  ];

  const typeFilters: Array<{ value: NotificationType | 'all'; label: string }> = [
    { value: 'all', label: t('page.typeAll') },
    ...TYPE_FILTER_ORDER.map((value) => ({
      value,
      label: t(NOTIFICATION_TYPE_LABEL_KEYS[value] ?? NOTIFICATION_TYPE_FALLBACK_LABEL_KEY),
    })),
  ];

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title={t('page.title')}
        description={t('page.description')}
        actions={
          <>
            <Button variant="secondary" onClick={readAll} disabled={markAllRead.isPending || unreadCount === 0}>
              {markAllRead.isPending ? t('page.markingAllRead') : t('page.markAllRead')}
            </Button>
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={totalCount === 0 || clearNotifications.isPending}
              className={clsx(
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors',
                'text-rose-600 hover:bg-rose-50 active:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40',
                'dark:text-rose-300 dark:hover:bg-rose-500/10 dark:active:bg-rose-500/15',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 dark:focus-visible:ring-offset-gray-800',
              )}
            >
              <TrashIcon className="h-3.5 w-3.5" />
              {t('page.clearAll')}
            </button>
          </>
        }
      />

      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-surface-3 bg-surface-1/70 p-0.5 dark:border-gray-700 dark:bg-gray-900/40">
            {filters.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => {
                  setFilter(key);
                  setPage(1);
                }}
                className={clsx(
                  'h-7 rounded-md px-3 text-xs font-medium transition-all',
                  filter === key
                    ? 'bg-surface-0 text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {t('page.total', { count: totalCount })}
          </span>
        </div>
        <div
          role="group"
          aria-label={t('page.typeFilterLabel')}
          className="flex flex-wrap items-center gap-1.5"
        >
          {typeFilters.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={typeFilter === value}
              onClick={() => {
                setTypeFilter(value);
                setPage(1);
              }}
              className={clsx(
                'h-7 rounded-full border px-2.5 text-[11px] font-medium transition-colors',
                typeFilter === value
                  ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-600/15 dark:text-brand-300'
                  : 'border-surface-3 bg-surface-0 text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <EmptyState
            title={t('page.errorTitle')}
            description={t('page.errorBody')}
            action={{ label: t('page.reload'), onClick: () => void refetch() }}
          />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title={
              typeFilter !== 'all'
                ? t('page.emptyTypeTitle', {
                    type: t(
                      NOTIFICATION_TYPE_LABEL_KEYS[typeFilter] ??
                        NOTIFICATION_TYPE_FALLBACK_LABEL_KEY,
                    ),
                  })
                : filter === 'unread'
                  ? t('page.emptyUnreadTitle')
                  : t('page.emptyTitle')
            }
            description={
              typeFilter !== 'all' ? t('page.emptyTypeBody') : t('page.emptyBody')
            }
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-surface-2 dark:divide-gray-700/60">
              {items.map((item) => {
                const meta = TYPE_META[item.type] ?? TYPE_META['feedback.created'];
                const unread = !item.read_at;
                const typeLabel = t(
                  NOTIFICATION_TYPE_LABEL_KEYS[item.type] ?? NOTIFICATION_TYPE_FALLBACK_LABEL_KEY,
                );
                return (
                  <li
                    key={item.id}
                    className={clsx(
                      'group flex items-stretch transition-colors',
                      unread
                        ? 'bg-brand-50/40 hover:bg-brand-50/70 dark:bg-brand-600/10 dark:hover:bg-brand-600/15'
                        : 'hover:bg-surface-1/60 dark:hover:bg-gray-700/20',
                    )}
                  >
                    <button
                      onClick={() => open(item)}
                      className="flex min-w-0 flex-1 items-start gap-3 py-3.5 pl-5 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/45"
                    >
                      <span
                        className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${meta.dot}18`, color: meta.dot }}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.dot }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-800 dark:text-gray-100">
                            {item.title}
                          </span>
                          <span className="shrink-0">
                            <Badge tone={meta.tone}>{typeLabel}</Badge>
                          </span>
                          {unread && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                          )}
                        </span>
                        {item.body && (
                          <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
                            {item.body}
                          </span>
                        )}
                        <span className="mt-1 block text-[11px] text-gray-400 dark:text-gray-500">
                          {formatRelativeTime(item.created_at)}
                        </span>
                      </span>
                    </button>
                    <span className="flex shrink-0 items-start pr-2.5 pt-2">
                      <button
                        type="button"
                        aria-label={t('aria.deleteNotification')}
                        title={t('aria.deleteNotification')}
                        disabled={
                          deleteNotification.isPending &&
                          deleteNotification.variables === item.id
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          remove(item);
                        }}
                        className={clsx(
                          'flex h-9 w-9 items-center justify-center rounded-lg transition-all',
                          'text-gray-400 hover:bg-rose-50 hover:text-rose-600 dark:text-gray-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400',
                          'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 max-md:opacity-100',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 disabled:cursor-not-allowed',
                        )}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={(next) => {
              setPage(next);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}

      <Card className="p-5">
        <CardHeader
          title={t('page.settings.title')}
          description={t('page.settings.description')}
          className="mb-2"
        />
        {!settings ? (
          <div className="space-y-2 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-surface-2 dark:divide-gray-700/60">
            {SETTING_ROWS.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200">
                    {t(row.labelKey)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                    {t(row.descriptionKey)}
                  </p>
                </div>
                <Switch
                  checked={settings[row.key]}
                  onChange={(value) => toggleSetting(row.key, value)}
                  label={t('page.settings.switchLabel', { name: t(row.labelKey) })}
                  showState
                  stateLabels={[t('page.settings.enabled'), t('page.settings.disabled')]}
                  disabled={settingsMutation.isPending}
                />
              </li>
            ))}
            <li className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200">
                    {t('page.settings.dnd.title')}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                    {t('page.settings.dnd.description')}
                  </p>
                </div>
                <Switch
                  checked={dnd.enabled}
                  onChange={(value) => updateDnd({ enabled: value })}
                  label={t('page.settings.dnd.switchLabel')}
                  showState
                  stateLabels={[t('page.settings.enabled'), t('page.settings.disabled')]}
                  disabled={settingsMutation.isPending}
                />
              </div>

              <div className="mt-3 space-y-2">
                {dnd.slots.map((slot, index) => {
                  const timesInvalid =
                    !DND_TIME_RE.test(slot.start) || !DND_TIME_RE.test(slot.end);
                  const sameTime = !timesInvalid && slot.start === slot.end;
                  const rowInvalid = timesInvalid || sameTime;
                  return (
                    <div
                      key={index}
                      className="rounded-lg border border-surface-3/70 bg-surface-1/40 px-3 py-2 dark:border-gray-700/60 dark:bg-gray-900/20"
                    >
                      <div className="flex flex-wrap items-end gap-2.5">
                        <span className="pb-2 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                          {t('page.settings.dnd.slotLabel', { index: index + 1 })}
                        </span>
                        <div>
                          <label htmlFor={`dnd-slot-${index}-start`} className={fieldLabelClass}>
                            {t('page.settings.dnd.start')}
                          </label>
                          <input
                            id={`dnd-slot-${index}-start`}
                            type="time"
                            value={slot.start}
                            onChange={(event) => updateSlot(index, { start: event.target.value })}
                            disabled={!dnd.enabled || settingsMutation.isPending}
                            aria-invalid={rowInvalid}
                            className={clsx(
                              timeInputClass,
                              rowInvalid &&
                                'border-rose-400 focus:border-rose-400 focus:ring-rose-500/15',
                            )}
                          />
                        </div>
                        <span className="pb-2 text-xs text-gray-400 dark:text-gray-500">–</span>
                        <div>
                          <label htmlFor={`dnd-slot-${index}-end`} className={fieldLabelClass}>
                            {t('page.settings.dnd.end')}
                          </label>
                          <input
                            id={`dnd-slot-${index}-end`}
                            type="time"
                            value={slot.end}
                            onChange={(event) => updateSlot(index, { end: event.target.value })}
                            disabled={!dnd.enabled || settingsMutation.isPending}
                            aria-invalid={rowInvalid}
                            className={clsx(
                              timeInputClass,
                              rowInvalid &&
                                'border-rose-400 focus:border-rose-400 focus:ring-rose-500/15',
                            )}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSlot(index)}
                          disabled={settingsMutation.isPending}
                          aria-label={t('page.settings.dnd.removeSlot', { index: index + 1 })}
                          title={t('page.settings.dnd.removeSlot', { index: index + 1 })}
                          className="mb-0.5 ml-auto flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                      {rowInvalid && (
                        <p role="alert" className="mt-1.5 text-[11px] text-rose-600 dark:text-rose-400">
                          {sameTime
                            ? t('page.settings.dnd.sameTimeError')
                            : t('page.settings.dnd.invalidTime')}
                        </p>
                      )}
                    </div>
                  );
                })}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={addSlot}
                    disabled={
                      dnd.slots.length >= MAX_DND_SLOTS ||
                      !dnd.enabled ||
                      settingsMutation.isPending
                    }
                  >
                    + {t('page.settings.dnd.addSlot')}
                  </Button>
                  {dnd.slots.length >= MAX_DND_SLOTS && (
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                      {t('page.settings.dnd.maxSlotsHint', { count: MAX_DND_SLOTS })}
                    </span>
                  )}
                  {dndDirty && (
                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDndDraft(null)}
                        disabled={settingsMutation.isPending}
                      >
                        {t('page.settings.dnd.cancel')}
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveDnd}
                        disabled={!dndCanSave || settingsMutation.isPending}
                      >
                        {settingsMutation.isPending
                          ? t('page.settings.dnd.saving')
                          : t('page.settings.dnd.save')}
                      </Button>
                    </div>
                  )}
                </div>
                {dnd.enabled && dnd.slots.length === 0 && (
                  <p role="alert" className="text-[11px] text-accent-600 dark:text-accent-300">
                    {t('page.settings.dnd.emptySlotsHint')}
                  </p>
                )}
              </div>
            </li>
            <li className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200">
                    {t('page.settings.mutedProjects.title')}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                    {t('page.settings.mutedProjects.description')}
                  </p>
                </div>
                <Badge tone="gray">
                  {t('page.settings.mutedProjects.count', { count: mutedProjects.length })}
                </Badge>
              </div>

              {projectsLoading ? (
                <div className="mt-2 space-y-1.5">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <Skeleton key={index} className="h-9 w-full" />
                  ))}
                </div>
              ) : projectOptions.length === 0 ? (
                <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                  {t('page.settings.mutedProjects.empty')}
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-surface-2 overflow-hidden rounded-lg border border-surface-3 dark:divide-gray-700/60 dark:border-gray-700/60">
                  {projectOptions.map((project) => {
                    const muted = mutedProjects.includes(project.id);
                    const atLimit =
                      !muted && mutedProjects.length >= MAX_MUTED_PROJECTS;
                    const disabled = atLimit || settingsMutation.isPending;
                    return (
                      <li key={project.id}>
                        <label
                          className={clsx(
                            'flex items-center gap-3 px-3 py-2.5 transition-colors',
                            disabled
                              ? 'cursor-not-allowed opacity-60'
                              : 'cursor-pointer hover:bg-surface-1/60 dark:hover:bg-gray-700/20',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={muted}
                            disabled={disabled}
                            onChange={() => toggleMutedProject(project.id)}
                            aria-label={t('page.settings.mutedProjects.switchLabel', {
                              name: project.name,
                            })}
                            className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-brand-600 accent-brand-600 focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-700"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-gray-800 dark:text-gray-200">
                              {project.name}
                            </span>
                            <span className="mt-0.5 block truncate font-mono text-[11px] text-gray-400 dark:text-gray-500">
                              {project.slug}
                            </span>
                          </span>
                          {muted && (
                            <Badge tone="gray">{t('page.settings.mutedProjects.muted')}</Badge>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              {mutedProjects.length >= MAX_MUTED_PROJECTS && (
                <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                  {t('page.settings.mutedProjects.limitHint', { count: MAX_MUTED_PROJECTS })}
                </p>
              )}
            </li>
          </ul>
        )}
      </Card>

      {confirmClear && (
        <Modal
          title={t('page.clear.title')}
          description={t('page.clear.description')}
          size="sm"
          onClose={() => setConfirmClear(false)}
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmClear(false)}
                disabled={clearNotifications.isPending}
              >
                {t('page.clear.cancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmClearAll}
                disabled={clearNotifications.isPending}
              >
                {clearNotifications.isPending
                  ? t('page.clear.confirming')
                  : t('page.clear.confirm')}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {t('page.clear.body', { count: totalCount })}
          </p>
        </Modal>
      )}
    </div>
  );
}
