import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { apiRequest } from '@/api/client';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardHeader, StatCard, EmptyState } from '@/components/ui';
import { TotalIcon, OpenIcon, ProgressIcon, ResolvedIcon, ClosedIcon, ResponseTimeIcon } from '@/components/icons';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import { useFirstProject } from '@/hooks/useOnboarding';
import type { FeedbackItem, PaginatedResponse, Stats } from '@/types';

type DashboardStats = Stats;

const PIE_COLORS = ['#6366f1', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#6b7280'];

export function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const firstProject = useFirstProject();
  const recentProjectId = firstProject?.projectId;

  const STAT_CARDS = [
    { key: 'total', label: t('dashboard.total_feedback'), icon: <TotalIcon />, accent: 'bg-gray-50 text-gray-700 dark:bg-gray-700 dark:text-gray-200' },
    { key: 'open', label: t('dashboard.open_count'), icon: <OpenIcon />, accent: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    { key: 'in_progress', label: t('feedback.status_in_progress'), icon: <ProgressIcon />, accent: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    { key: 'resolved', label: t('dashboard.resolved_count'), icon: <ResolvedIcon />, accent: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    { key: 'closed', label: t('feedback.status_closed'), icon: <ClosedIcon />, accent: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
  ] as const;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiRequest<DashboardStats>('/admin/stats'),
  });

  const { data: recent } = useQuery({
    queryKey: ['feedback', 1, {}],
    queryFn: () => apiRequest<PaginatedResponse<FeedbackItem>>('/admin/feedback?page=1&page_size=5'),
  });

  if (statsLoading) return <DashboardSkeleton />;
  if (!stats) return <EmptyState title="加载失败" description="请刷新页面重试" />;

  const categoryData = Object.entries(stats.by_category).map(([name, value]) => ({ name, value }));
  const maxCategory = Math.max(...Object.values(stats.by_category), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {STAT_CARDS.map((card) => (
          <StatCard
            key={card.key}
            label={card.label}
            value={stats[card.key]}
            icon={card.icon}
            accent={card.accent}
          />
        ))}
      </div>
      {stats.avg_response_hours !== undefined && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="平均响应时间"
            value={`${stats.avg_response_hours}h`}
            icon={<ResponseTimeIcon />}
            accent="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
          />
        </div>
      )}

      {stats.by_week?.length > 0 && (
        <Card className="p-5">
          <CardHeader title="周趋势" className="mb-4" />
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.by_week}>
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => v.replace(/^\d{4}-W/, 'W')} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#trendGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {stats.by_month !== undefined && stats.by_month.length > 1 && (
          <Card className="p-5">
            <CardHeader title="月度趋势" className="mb-4" />
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.by_month}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {stats.by_source && Object.keys(stats.by_source).length > 0 && (
          <Card className="p-5">
            <CardHeader title="来源分布" className="mb-4" />
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(stats.by_source).map(([name, value]) => ({ name, value }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {Object.entries(stats.by_source).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">最近反馈</h2>
            <button
              onClick={() => navigate('/feedback')}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
            >
              查看全部 →
            </button>
          </div>
          {recent?.items.length ? (
            <div className="space-y-1">
              {recent.items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/feedback/${item.id}`)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-1 dark:hover:bg-gray-700"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{formatRelativeTime(item.created_at)}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="暂无反馈"
              description="还没有收到反馈，嵌入 Widget 开始收集用户声音"
              action={
                recentProjectId
                  ? { label: '获取嵌入代码', onClick: () => navigate(`/projects/${recentProjectId}/widget`) }
                  : undefined
              }
            />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">分类分布</h2>
          <div className="space-y-3">
            {categoryData.map((cat, i) => (
              <div key={cat.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{cat.name}</span>
                  <span className="text-gray-500 dark:text-gray-400 tabular-nums">{cat.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(cat.value / maxCategory) * 100}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 w-16 rounded bg-surface-2 dark:bg-gray-700" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-2 dark:bg-gray-700" />
        ))}
      </div>
      <div className="h-56 rounded-xl bg-surface-2 dark:bg-gray-700" />
    </div>
  );
}
