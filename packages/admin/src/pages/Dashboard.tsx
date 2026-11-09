import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiRequest } from '@/api/client';
import { StatusBadge } from '@/components/StatusBadge';
import { CategoryBadge, SourceBadge } from '@/components/badges';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, CardHeader, EmptyState, Skeleton, StatCard } from '@/components/ui';
import {
  ClosedIcon,
  OpenIcon,
  ProgressIcon,
  ResolvedIcon,
  ResponseTimeIcon,
  TotalIcon,
} from '@/components/icons';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import { useFirstProject } from '@/hooks/useOnboarding';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { CATEGORY_PALETTE, categoryColor, categoryLabel, sourceLabel } from '@/utils/labels';
import { fillLastWeeks } from '@/utils/weekSeries';
import type { FeedbackItem, PaginatedResponse, Stats } from '@/types';

type DashboardStats = Stats;

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
  const axisColor = theme === 'dark' ? '#64748b' : '#94a3b8';
  const gridColor = theme === 'dark' ? '#1f2937' : '#eef1f5';
  const tooltipStyle = {
    borderRadius: 10,
    border: `1px solid ${theme === 'dark' ? '#334155' : '#e5e8ee'}`,
    background: theme === 'dark' ? '#111827' : '#ffffff',
    boxShadow: '0 8px 24px -12px rgb(15 23 42 / 0.2)',
    fontSize: 12,
    color: theme === 'dark' ? '#e2e8f0' : '#0f172a',
  } as const;

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
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekly} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3D5AFE" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#3D5AFE" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridColor} strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                  dy={8}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ stroke: '#3D5AFE', strokeDasharray: '4 4', strokeOpacity: 0.35 }}
                  formatter={(value) => [`${value}`, t('dashboard.total_feedback')]}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3D5AFE"
                  strokeWidth={2.4}
                  fill="url(#trendGradient)"
                  dot={{ r: 3, strokeWidth: 2, fill: theme === 'dark' ? '#111827' : '#ffffff' }}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex flex-col p-5">
          <CardHeader
            title={t('dashboard.source_title')}
            description={t('dashboard.source_desc')}
            className="mb-2"
          />
          {sourceData.length ? (
            <>
              <div className="relative mx-auto h-[168px] w-full max-w-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceData}
                      dataKey="value"
                      innerRadius="62%"
                      outerRadius="92%"
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {sourceData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">
                    {sourceTotal}
                  </span>
                  <span className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                    {t('dashboard.total_hint')}
                  </span>
                </div>
              </div>
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
            <EmptyState title={t('dashboard.no_data')} className="py-8" />
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
            <EmptyState title={t('dashboard.no_data')} className="py-8" />
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
