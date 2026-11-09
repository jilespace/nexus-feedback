import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { lazy, Suspense } from 'react';
import { apiRequest, fetchAuditLogs } from '@/api/client';
import { StatusBadge } from '@/components/StatusBadge';
import { CategoryBadge, SourceBadge } from '@/components/badges';
import { PageHeader } from '@/components/PageHeader';
import { Badge, Button, Card, CardHeader, EmptyState, Skeleton, StatCard } from '@/components/ui';
import {
  ClosedIcon,
  OpenIcon,
  ProgressIcon,
  ResolvedIcon,
  ResponseTimeIcon,
  TotalIcon,
} from '@/components/icons';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import { auditActionLabel, auditActionTone, auditTargetLabel } from '@/utils/auditLabels';
import { useFirstProject } from '@/hooks/useOnboarding';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { CATEGORY_PALETTE, categoryColor, categoryLabel, sourceLabel } from '@/utils/labels';
import { fillLastWeeks } from '@/utils/weekSeries';
import type { AuditLog, FeedbackItem, PaginatedResponse, Stats } from '@/types';

type DashboardStats = Stats;

const TrendChart = lazy(() => import('@/components/dashboard/TrendChart'));
const SourceDonut = lazy(() => import('@/components/dashboard/SourceDonut'));

function greetingKey(hour: number): string {
  if (hour < 12) return 'dashboard.greeting_morning';
  if (hour < 18) return 'dashboard.greeting_afternoon';
  return 'dashboard.greeting_evening';
}

export function Dashboard() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { member } = useAuth();
  const firstProject = useFirstProject();
  const recentProjectId = firstProject?.projectId;

  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiRequest<DashboardStats>('/admin/stats'),
  });
  const recentQuery = useQuery({
    queryKey: ['feedback', 1, {}],
    queryFn: () => apiRequest<PaginatedResponse<FeedbackItem>>('/admin/feedback?page=1&page_size=5'),
  });

  const canViewAudit = member?.role === 'owner' || member?.role === 'admin';
  const activityQuery = useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: () => fetchAuditLogs({ page: 1, page_size: 6 }),
    enabled: canViewAudit,
  });
  const assignedQuery = useQuery({
    queryKey: ['my-assignments', member?.id],
    queryFn: () =>
      apiRequest<PaginatedResponse<FeedbackItem>>(
        `/admin/feedback?assignee_id=${member!.id}&page_size=4&view=active`,
      ),
    enabled: Boolean(member?.id),
  });

  const stats = statsQuery.data;
  if (statsQuery.isLoading) return <DashboardSkeleton />;
  if (!stats) {
    return (
      <EmptyState
        title={t('dashboard.load_failed')}
        description={t('dashboard.load_failed_desc')}
      />
    );
  }

  const lang = i18n.language;
  const userName = member?.display_name || member?.email?.split('@')[0] || '';
  const greeting = t(greetingKey(new Date().getHours()));
  const locale = lang.startsWith('en') ? 'en-US' : 'zh-CN';
  const now = new Date();
  const today = `${now.toLocaleDateString(locale, { month: 'long', day: 'numeric' })} · ${now.toLocaleDateString(locale, { weekday: 'long' })}`;

  const weekly = fillLastWeeks(stats.by_week ?? [], 8);
  const weekNew = weekly[weekly.length - 1]?.count ?? 0;
  const isDark = theme === 'dark';

  const sourceEntries = Object.entries(stats.by_source ?? {});
  const sourceTotal = sourceEntries.reduce((sum, [, value]) => sum + value, 0);
  const sourceData = sourceEntries.map(([name, value], i) => ({
    name: sourceLabel(name, lang),
    value,
    color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]!,
    pct: sourceTotal ? Math.round((value / sourceTotal) * 100) : 0,
  }));

  const categoryEntries = Object.entries(stats.by_category ?? {}).sort((a, b) => b[1] - a[1]);
  const maxCategory = Math.max(...categoryEntries.map(([, v]) => v), 1);

  const pct = (n: number) => (stats.total ? Math.round((n / stats.total) * 100) : 0);

  const statCards = [
    {
      key: 'total',
      label: t('dashboard.total_feedback'),
      value: stats.total,
      icon: <TotalIcon />,
      tone: 'brand' as const,
      hint: t('dashboard.week_new', { count: weekNew }),
    },
    {
      key: 'open',
      label: t('dashboard.open_count'),
      value: stats.open,
      icon: <OpenIcon />,
      tone: 'amber' as const,
      hint: t('dashboard.percent_of_total', { pct: pct(stats.open) }),
    },
    {
      key: 'in_progress',
      label: t('feedback.status_in_progress'),
      value: stats.in_progress,
      icon: <ProgressIcon />,
      tone: 'blue' as const,
      hint: t('dashboard.percent_of_total', { pct: pct(stats.in_progress) }),
    },
    {
      key: 'resolved',
      label: t('dashboard.resolved_count'),
      value: stats.resolved,
      icon: <ResolvedIcon />,
      tone: 'green' as const,
      hint: t('dashboard.percent_of_total', { pct: pct(stats.resolved) }),
    },
    {
      key: 'closed',
      label: t('feedback.status_closed'),
      value: stats.closed,
      icon: <ClosedIcon />,
      tone: 'gray' as const,
      hint: t('dashboard.percent_of_total', { pct: pct(stats.closed) }),
    },
    {
      key: 'response',
      label: t('dashboard.avg_response'),
      value:
        (stats.response_count ?? 0) === 0
          ? '—'
          : (stats.avg_response_hours ?? 0) < 1
            ? '<1h'
            : `${Math.round(stats.avg_response_hours ?? 0)}h`,
      icon: <ResponseTimeIcon />,
      tone: 'violet' as const,
      hint: stats.response_count
        ? t('dashboard.replied_hint', { count: stats.response_count })
        : t('dashboard.no_reply_hint'),
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title={`${greeting}${userName ? `，${userName}` : ''}`}
        description={
          stats.open > 0 ? t('dashboard.summary', { count: stats.open }) : t('dashboard.summary_clear')
        }
        eyebrow={today}
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                void statsQuery.refetch();
                void recentQuery.refetch();
              }}
              disabled={statsQuery.isFetching}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="none"
                className={statsQuery.isFetching ? 'animate-spin' : undefined}
              >
                <path
                  d="M16 10a6 6 0 11-1.85-4.32M16 4v4h-4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t('dashboard.refresh')}
            </Button>
            <Button onClick={() => navigate('/feedback')}>{t('dashboard.view_all')}</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 xl:gap-4">
        {statCards.map((card) => (
          <StatCard
            key={card.key}
            label={card.label}
            value={card.value}
            icon={card.icon}
            tone={card.tone}
            hint={card.hint}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Card className="p-5 lg:col-span-2">
          <CardHeader
            title={t('dashboard.trend_title')}
            description={t('dashboard.trend_desc')}
            className="mb-5"
            action={
              <span className="rounded-md bg-surface-1 px-2 py-1 text-[11px] font-medium text-gray-500 dark:bg-gray-700/50 dark:text-gray-400">
                {t('dashboard.this_week')} +{weekNew}
              </span>
            }
          />
          <Suspense fallback={<Skeleton className="h-[220px] rounded-lg" />}>
            <TrendChart data={weekly} isDark={isDark} tooltipLabel={t('dashboard.total_feedback')} />
          </Suspense>
        </Card>

        <Card className="flex flex-col p-5">
          <CardHeader
            title={t('dashboard.source_title')}
            description={t('dashboard.source_desc')}
            className="mb-2"
          />
          {sourceData.length ? (
            <>
              <Suspense fallback={<Skeleton className="mx-auto h-[168px] max-w-[220px] rounded-full" />}>
                <SourceDonut
                  sources={sourceData}
                  total={sourceTotal}
                  totalLabel={t('dashboard.total_hint')}
                  isDark={isDark}
                />
              </Suspense>
              <ul className="mt-3 space-y-2">
                {sourceData.map((source) => (
                  <li key={source.name} className="flex items-center gap-2.5 text-xs">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: source.color }}
                    />
                    <span className="flex-1 truncate text-gray-600 dark:text-gray-300">
                      {source.name}
                    </span>
                    <span className="tabular-nums text-gray-400 dark:text-gray-500">
                      {source.pct}%
                    </span>
                    <span className="w-6 text-right font-medium tabular-nums text-gray-700 dark:text-gray-200">
                      {source.value}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState title={t('dashboard.activity_empty')} className="py-8" />
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Card className="p-5 lg:col-span-2">
          <CardHeader
            title={t('dashboard.recent_title')}
            description={t('dashboard.recent_desc')}
            className="mb-4"
            action={
              <button
                onClick={() => navigate('/feedback')}
                className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                {t('dashboard.view_all')} →
              </button>
            }
          />
          {recentQuery.data?.items.length ? (
            <div className="-mx-2 space-y-0.5">
              {recentQuery.data.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/feedback/${item.id}`)}
                  className="group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-surface-1 dark:hover:bg-gray-700/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-gray-800 group-hover:text-gray-900 dark:text-gray-200 dark:group-hover:text-gray-50">
                      {item.title}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
                      <CategoryBadge category={item.category} />
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <SourceBadge source={item.source} />
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <span>{formatRelativeTime(item.created_at)}</span>
                    </div>
                  </div>
                  <StatusBadge status={item.status} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title={t('dashboard.latest_empty')}
              description={t('dashboard.latest_empty_desc')}
              action={
                recentProjectId
                  ? {
                      label: t('dashboard.get_embed'),
                      onClick: () => navigate(`/projects/${recentProjectId}/widget`),
                    }
                  : undefined
              }
            />
          )}
        </Card>

        <Card className="p-5">
          <CardHeader
            title={t('dashboard.category_title')}
            description={t('dashboard.category_desc')}
            className="mb-5"
          />
          {categoryEntries.length ? (
            <div className="space-y-4">
              {categoryEntries.map(([name, value]) => (
                <div key={name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: categoryColor(name) }}
                      />
                      {categoryLabel(name, lang)}
                    </span>
                    <span className="tabular-nums text-gray-400 dark:text-gray-500">
                      {value}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2 dark:bg-gray-700">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(value / maxCategory) * 100}%`,
                        backgroundColor: categoryColor(name),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title={t('dashboard.activity_empty')} className="py-8" />
          )}
        </Card>
      </div>

      <div className={canViewAudit ? 'grid gap-4 lg:grid-cols-3 lg:gap-6' : 'grid gap-4'}>
        {canViewAudit && (
          <Card className="p-5 lg:col-span-2">
            <CardHeader
              title={t('dashboard.activity_title')}
              description={t('dashboard.activity_desc')}
              className="mb-4"
              action={
                <button
                  onClick={() => navigate('/audit-logs')}
                  className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  {t('dashboard.view_all')} →
                </button>
              }
            />
            {activityQuery.data?.items.length ? (
              <ul className="-mx-2 space-y-0.5">
                {activityQuery.data.items.map((activity: AuditLog) => (
                  <li key={activity.id}>
                    <button
                      onClick={() => navigate('/audit-logs')}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-1 dark:hover:bg-gray-700/40"
                    >
                      <Badge tone={auditActionTone(activity.action)}>
                        {auditActionLabel(activity.action)}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-gray-600 dark:text-gray-300">
                        {auditTargetLabel(activity.target_type)}
                        {typeof activity.metadata?.title === 'string'
                          ? `「${activity.metadata.title}」`
                          : activity.target_id
                            ? ` #${activity.target_id.slice(0, 8)}`
                            : ''}
                      </span>
                      <span className="hidden shrink-0 text-[11px] text-gray-400 dark:text-gray-500 sm:block">
                        {activity.member?.display_name || t('dashboard.system_actor')}
                      </span>
                      <span className="w-16 shrink-0 text-right text-[11px] text-gray-400 dark:text-gray-500">
                        {formatRelativeTime(activity.created_at)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={t('dashboard.activity_empty')} className="py-8" />
            )}
          </Card>
        )}

        <Card className="p-5">
          <CardHeader
            title={t('dashboard.assigned_title')}
            description={t('dashboard.assigned_desc')}
            className="mb-4"
            action={
              <button
                onClick={() => navigate('/feedback')}
                className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                {t('dashboard.view_all')} →
              </button>
            }
          />
          {assignedQuery.data?.items.length ? (
            <ul className="-mx-2 space-y-0.5">
              {assignedQuery.data.items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => navigate(`/feedback/${item.id}`)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-1 dark:hover:bg-gray-700/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-gray-800 dark:text-gray-200">
                        {item.title}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                        <CategoryBadge category={item.category} />
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </span>
                    <StatusBadge status={item.status} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={t('dashboard.assigned_empty')}
              description={t('dashboard.assigned_empty_desc')}
              className="py-6"
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 xl:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Skeleton className="h-[320px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[320px] rounded-xl" />
      </div>
    </div>
  );
}
