import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { apiRequest } from '@/api/client';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { TableSkeleton, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { SearchIcon } from '@/components/icons';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import { useAuth } from '@/hooks/useAuth';
import { fetchOrgMembers } from '@/api/client';
import type { FeedbackItem, PaginatedResponse, FeedbackPriority, FeedbackSource } from '@/types';

const SOURCE_LABELS: Record<string, { label: string; className: string }> = {
  widget: { label: 'Widget', className: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300' },
  'submit-page': { label: '提交页', className: 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-300' },
  api: { label: 'API', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  board: { label: '看板', className: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300' },
};

const PRIORITY_CONFIG: Record<FeedbackPriority, { label: string; className: string }> = {
  low: { label: '低', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  medium: { label: '中', className: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' },
  high: { label: '高', className: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300' },
  critical: { label: '紧急', className: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300' },
};

export function FeedbackList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { show: toast } = useToast();
  const { member: currentMember } = useAuth();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'most_voted'>('newest');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: members } = useQuery({
    queryKey: ['org-members'],
    queryFn: fetchOrgMembers,
  });

  const handleKeywordChange = useCallback((value: string) => {
    setKeyword(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedKeyword(value);
      setPage(1);
    }, 300);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const queryParams = new URLSearchParams({
    page: String(page),
    page_size: '20',
    ...filters,
    ...(debouncedKeyword ? { keyword: debouncedKeyword } : {}),
    sort_by: sortBy,
    ...(assigneeFilter ? { assignee_id: assigneeFilter } : {}),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['feedback', page, filters, debouncedKeyword, sortBy],
    queryFn: () =>
      apiRequest<PaginatedResponse<FeedbackItem>>(`/admin/feedback?${queryParams}`),
  });

  const batchMutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiRequest<{ updated: number }>('/admin/feedback/batch-status', {
        method: 'PATCH',
        body: JSON.stringify({ ids, status: 'closed' }),
      }),
    onSuccess: (res) => {
      toast(`已关闭 ${res.updated} 条反馈`, 'success');
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
    onError: (err: Error) => {
      toast(err.message || '操作失败', 'error');
    },
  });

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!data?.items.length) return;
    if (selected.size === data.items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.items.map((i) => i.id)));
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('feedback.list_title')}</h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {data ? t('feedback.total_count', { count: data.total }) : ''}
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <input
            value={keyword}
            onChange={(e) => handleKeywordChange(e.target.value)}
            placeholder={t('feedback.search_placeholder')}
            data-shortcut-search
            className="w-full rounded-lg border border-surface-3 bg-surface-0 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500 transition-shadow"
          />
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setPage(1); }}
          className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
        >
          <option value="newest">最新优先</option>
          <option value="oldest">最早优先</option>
          <option value="most_voted">最多投票</option>
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => { setAssigneeFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
        >
          <option value="">全部成员</option>
          {currentMember && (
            <option value={currentMember.id}>分配给我</option>
          )}
          {members?.filter(m => m.id !== currentMember?.id).map(m => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </select>
        <FilterBar filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} />
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 dark:border-brand-800 dark:bg-brand-900/20">
          <span className="text-sm font-medium text-brand-700 dark:text-brand-300">{t('feedback.selected_count', { count: selected.size })}</span>
          <button
            onClick={() => batchMutation.mutate(Array.from(selected))}
            disabled={batchMutation.isPending}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            {batchMutation.isPending ? t('common.loading') : t('feedback.batch_close')}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-brand-600 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-200 focus:outline-none"
          >
            {t('feedback.cancel_select')}
          </button>
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={<SearchIcon className="text-gray-400" />}
          title="暂无反馈"
          description="当有新的反馈提交时，将会显示在这里"
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-surface-3 bg-surface-0 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-surface-3 bg-surface-1 dark:border-gray-700 dark:bg-gray-800">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={data.items.length > 0 && selected.size === data.items.length}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-200 dark:border-gray-600 dark:bg-gray-700"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('feedback.col_title')}</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('feedback.col_source')}</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('feedback.col_category')}</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('feedback.col_priority')}</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('feedback.col_status')}</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('feedback.col_time')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-2 dark:divide-gray-700">
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    data-shortcut-item
                    className={clsx(
                      'transition-colors hover:bg-brand-50/40 dark:hover:bg-brand-900/20 cursor-pointer',
                      selected.has(item.id) && 'bg-brand-50/20 dark:bg-brand-900/10',
                    )}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-200 dark:border-gray-600 dark:bg-gray-700"
                      />
                    </td>
                    <td className="px-4 py-3" onClick={() => navigate(`/feedback/${item.id}`)}>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{item.title}</span>
                      {item.reply_count > 0 && (
                        <span className="ml-2 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-100 px-1 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                          {item.reply_count}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={() => navigate(`/feedback/${item.id}`)}>
                      <SourceBadge source={item.source} />
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400" onClick={() => navigate(`/feedback/${item.id}`)}>
                      {item.category}
                    </td>
                    <td className="px-4 py-3" onClick={() => navigate(`/feedback/${item.id}`)}>
                      <PriorityBadge priority={item.priority} />
                    </td>
                    <td className="px-4 py-3" onClick={() => navigate(`/feedback/${item.id}`)}><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400" onClick={() => navigate(`/feedback/${item.id}`)}>
                      {formatRelativeTime(item.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="space-y-3 lg:hidden">
            {data.items.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/feedback/${item.id}`)}
                className="rounded-xl border border-surface-3 bg-surface-0 p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatRelativeTime(item.created_at)}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <SourceBadge source={item.source} />
                  <PriorityBadge priority={item.priority} />
                  <span className="inline-flex items-center rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {item.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-2 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            {t('feedback.prev_page')}
          </button>
          <span className="px-2 text-sm text-gray-600 dark:text-gray-400 tabular-nums">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-2 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            {t('feedback.next_page')}
          </button>
        </div>
      )}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: FeedbackPriority }) {
  const config = PRIORITY_CONFIG[priority];
  return (
    <span className={clsx('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}

function SourceBadge({ source }: { source?: FeedbackSource }) {
  const config = SOURCE_LABELS[source ?? 'api'] ?? { label: source ?? 'API', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
  return (
    <span className={clsx('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}
