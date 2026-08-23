import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { apiRequest, assignFeedbackBatch, fetchOrgMembers, fetchOrgTags, restoreFeedback } from '@/api/client';
import type { FeedbackItem, PaginatedResponse, FeedbackPriority, FeedbackSource, ProjectAccessInfo } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { TableSkeleton, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { SearchIcon } from '@/components/icons';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import { useAuth } from '@/hooks/useAuth';
import { useSavedViews } from '@/hooks/useSavedViews';
import { useFirstProject } from '@/hooks/useOnboarding';


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
  const { member: currentMember, organization } = useAuth();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'most_voted'>('newest');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [view, setView] = useState<'active' | 'trash'>('active');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showViewSaver, setShowViewSaver] = useState(false);
  const [viewName, setViewName] = useState('');
  const [activeSavedView, setActiveSavedView] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savedViews = useSavedViews(organization?.id);
  const firstProject = useFirstProject();

  const { data: members } = useQuery({
    queryKey: ['org-members'],
    queryFn: fetchOrgMembers,
  });

  const { data: tags } = useQuery({
    queryKey: ['org-tags'],
    queryFn: fetchOrgTags,
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiRequest<ProjectAccessInfo[]>('/org/projects'),
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
    ...(projectFilter ? { project_id: projectFilter } : {}),
    ...(assigneeFilter ? { assignee_id: assigneeFilter } : {}),
    ...(tagFilter ? { tag_id: tagFilter } : {}),
    view,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['feedback', page, filters, debouncedKeyword, sortBy, assigneeFilter, tagFilter, view, projectFilter],
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

  const assignMutation = useMutation({
    mutationFn: ({ ids, assigneeId }: { ids: string[]; assigneeId: string | null }) =>
      assignFeedbackBatch(ids, assigneeId),
    onSuccess: (res) => {
      toast(`已分配 ${res.updated} 条`, 'success');
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
    onError: (err: Error) => {
      toast(err.message || '操作失败', 'error');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreFeedback(id),
    onSuccess: () => {
      toast('已恢复', 'success');
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
    onError: (err: Error) => {
      toast(err.message || '恢复失败', 'error');
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
          value={projectFilter}
          onChange={(e) => { setProjectFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
        >
          <option value="">全部项目</option>
          {(projects ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => { setAssigneeFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
        >
          <option value="">全部负责人</option>
          <option value="__unassigned__">未分配</option>
          {currentMember && (
            <option value={currentMember.id}>分配给我</option>
          )}
          {(Array.isArray(members) ? members : []).filter(m => m.id !== currentMember?.id).map(m => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </select>
        <select
          value={tagFilter}
          onChange={(e) => { setTagFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
        >
          <option value="">全部标签</option>
          {(Array.isArray(tags) ? tags : []).map((tag) => (
            <option key={tag.id} value={tag.id}>{tag.name}</option>
          ))}
        </select>
        <FilterBar filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-surface-3 bg-surface-0 p-0.5 dark:border-gray-600 dark:bg-gray-700">
          {([['active', '全部反馈'], ['trash', '回收站']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setView(key); setPage(1); setSelected(new Set()); }}
              className={clsx(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                view === key
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex items-center gap-2">
          <select
            value={activeSavedView}
            onChange={(e) => {
              const name = e.target.value;
              setActiveSavedView(name);
              const v = savedViews.views.find((sv) => sv.name === name);
              if (v) {
                setFilters({ ...v.filters });
                setProjectFilter(v.filters.project_id ?? '');
                setAssigneeFilter(v.filters.assignee_id ?? '');
                setTagFilter(v.filters.tag_id ?? '');
                setPage(1);
              }
            }}
            className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">视图</option>
            {savedViews.views.map((v) => (
              <option key={v.name} value={v.name}>{v.name}</option>
            ))}
          </select>
          {activeSavedView && (
            <button
              onClick={() => {
                savedViews.remove(activeSavedView);
                setActiveSavedView('');
                toast('已删除视图', 'success');
              }}
              title="删除当前视图"
              className="text-xs text-gray-400 transition-colors hover:text-red-500 focus:outline-none"
            >
              ✕
            </button>
          )}
          <button
            onClick={() => { setShowViewSaver(!showViewSaver); setViewName(''); }}
            title="保存当前筛选为视图"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-3 bg-surface-0 text-gray-500 transition-colors hover:bg-surface-2 hover:text-brand-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2h8.5L13 4.5V14H3V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M5 2v4h5V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 10h6v3H5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
          </button>
          {showViewSaver && (
            <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-surface-3 bg-surface-0 p-3 shadow-lg dark:border-gray-600 dark:bg-gray-800">
              <input
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="视图名称"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowViewSaver(false);
                  if (e.key === 'Enter' && viewName.trim()) {
                    const result = savedViews.save(viewName, {
                      ...filters,
                      ...(projectFilter ? { project_id: projectFilter } : {}),
                      ...(assigneeFilter ? { assignee_id: assigneeFilter } : {}),
                      ...(tagFilter ? { tag_id: tagFilter } : {}),
                    });
                    setShowViewSaver(false);
                    toast(result === 'updated' ? '已更新视图' : result === 'saved' ? '已保存视图' : '保存失败（已达上限 10 个）', 'success');
                  }
                }}
                className="w-full rounded-md border border-surface-3 bg-surface-0 px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              <button
                onClick={() => {
                  if (!viewName.trim()) return;
                  const result = savedViews.save(viewName, {
                    ...filters,
                    ...(projectFilter ? { project_id: projectFilter } : {}),
                    ...(assigneeFilter ? { assignee_id: assigneeFilter } : {}),
                    ...(tagFilter ? { tag_id: tagFilter } : {}),
                  });
                  setShowViewSaver(false);
                  toast(result === 'updated' ? '已更新视图' : result === 'saved' ? '已保存视图' : '保存失败（已达上限 10 个）', 'success');
                }}
                disabled={!viewName.trim()}
                className="mt-2 w-full rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 focus:outline-none"
              >
                保存
              </button>
            </div>
          )}
        </div>
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
          <select
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              assignMutation.mutate({ ids: Array.from(selected), assigneeId: e.target.value === '__unassigned__' ? null : e.target.value });
              e.target.value = '';
            }}
            disabled={assignMutation.isPending}
            className="rounded-md border border-brand-300 bg-surface-0 px-2 py-1.5 text-xs font-medium text-brand-700 focus:outline-none dark:border-brand-700 dark:bg-gray-700 dark:text-brand-300"
          >
            <option value="" disabled>{assignMutation.isPending ? '分配中...' : '分配给'}</option>
            <option value="__unassigned__">未分配</option>
            {(Array.isArray(members) ? members : []).map((m) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
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
        view === 'trash' ? (
          <EmptyState
            icon={<SearchIcon className="text-gray-400" />}
            title="回收站为空"
          />
        ) : (
          <EmptyState
            icon={<SearchIcon className="text-gray-400" />}
            title="暂无反馈"
            description="当有新的反馈提交时，将会显示在这里"
            action={
              !debouncedKeyword && Object.keys(filters).length === 0 && !assigneeFilter && !tagFilter && firstProject
                ? {
                    label: '获取嵌入代码',
                    onClick: () => navigate(`/projects/${firstProject.projectId}/widget`),
                  }
                : undefined
            }
          />
        )
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
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">负责人</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('feedback.col_tags')}</th>
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
                      view === 'trash' && 'opacity-60',
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
                      {view === 'trash' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('确定恢复该反馈？')) {
                              restoreMutation.mutate(item.id);
                            }
                          }}
                          disabled={restoreMutation.isPending}
                          className="ml-2 rounded-md border border-surface-3 px-1.5 py-0.5 text-[11px] font-medium text-gray-500 transition-colors hover:border-brand-300 hover:text-brand-600 focus:outline-none dark:border-gray-600 dark:text-gray-400"
                        >
                          恢复
                        </button>
                      )}
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
                      <AssigneeCell assignee={item.assignee} />
                    </td>
                    <td className="px-4 py-3" onClick={() => navigate(`/feedback/${item.id}`)}>
                      <TagChips tags={item.tags} />
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
                  <AssigneeCell assignee={item.assignee} />
                  <span className="inline-flex items-center rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {item.category}
                  </span>
                  <TagChips tags={item.tags} />
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

function AssigneeCell({ assignee }: { assignee?: { id: string; display_name: string } | null }) {
  if (!assignee) {
    return <span className="text-gray-300 dark:text-gray-600">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
        {assignee.display_name.charAt(0)}
      </span>
      <span className="text-xs text-gray-600 dark:text-gray-300">{assignee.display_name}</span>
    </span>
  );
}

function TagChips({ tags }: { tags?: { id: string; name: string; color: string | null }[] }) {
  if (!tags?.length) {
    return <span className="text-gray-300 dark:text-gray-600">—</span>;
  }
  const shown = tags.slice(0, 3);
  const rest = tags.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300"
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: tag.color ?? '#6b7280' }}
          />
          {tag.name}
        </span>
      ))}
      {rest > 0 && (
        <span className="text-xs text-gray-400 dark:text-gray-500">+{rest}</span>
      )}
    </div>
  );
}
