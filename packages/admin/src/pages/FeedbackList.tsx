import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  apiRequest,
  assignFeedbackBatch,
  downloadFeedbackCsv,
  fetchOrgMembers,
  fetchOrgTags,
  restoreFeedback,
} from '@/api/client';
import type { FeedbackItem, PaginatedResponse, ProjectAccessInfo } from '@/types';
import { FilterBar } from '@/components/FilterBar';
import { PageHeader } from '@/components/PageHeader';
import { Button, EmptyState, TableSkeleton } from '@/components/ui';
import { FeedbackTable } from '@/components/feedback/FeedbackTable';
import { FeedbackCards } from '@/components/feedback/FeedbackCards';
import { FeedbackBulkBar } from '@/components/feedback/FeedbackBulkBar';
import { Pagination } from '@/components/feedback/Pagination';
import { useToast } from '@/components/Toast';
import { SearchIcon } from '@/components/icons';
import { useAuth } from '@/hooks/useAuth';
import { useSavedViews } from '@/hooks/useSavedViews';
import { useFirstProject } from '@/hooks/useOnboarding';
import { categoryLabel, priorityLabel } from '@/utils/labels';

type SortBy = 'newest' | 'oldest' | 'most_voted';

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: 'newest', label: '最新优先' },
  { value: 'oldest', label: '最早优先' },
  { value: 'most_voted', label: '最多投票' },
];

const selectClass =
  'h-9 rounded-lg border border-surface-3 bg-surface-0 px-2.5 text-[13px] font-medium text-gray-600 transition-colors hover:border-gray-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600';

export function FeedbackList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const { show: toast } = useToast();
  const { member: currentMember, organization } = useAuth();
  const lang = i18n.language;

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [view, setView] = useState<'active' | 'trash'>('active');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showViewSaver, setShowViewSaver] = useState(false);
  const [viewName, setViewName] = useState('');
  const [activeSavedView, setActiveSavedView] = useState('');
  const [exporting, setExporting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savedViews = useSavedViews(organization?.id);
  const firstProject = useFirstProject();
  const canExport = currentMember?.role === 'owner' || currentMember?.role === 'admin';

  const { data: members } = useQuery({ queryKey: ['org-members'], queryFn: fetchOrgMembers });
  const { data: tags } = useQuery({ queryKey: ['org-tags'], queryFn: fetchOrgTags });
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiRequest<ProjectAccessInfo[]>('/org/projects'),
  });

  const memberList = Array.isArray(members) ? members : [];
  const tagList = Array.isArray(tags) ? tags : [];
  const projectList = projects ?? [];

  const handleKeywordChange = useCallback((value: string) => {
    setKeyword(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedKeyword(value);
      setPage(1);
    }, 280);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
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
    queryKey: [
      'feedback',
      page,
      filters,
      debouncedKeyword,
      sortBy,
      assigneeFilter,
      tagFilter,
      view,
      projectFilter,
    ],
    queryFn: () => apiRequest<PaginatedResponse<FeedbackItem>>(`/admin/feedback?${queryParams}`),
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
    onError: (err: Error) => toast(err.message || '操作失败', 'error'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ ids, assigneeId }: { ids: string[]; assigneeId: string | null }) =>
      assignFeedbackBatch(ids, assigneeId),
    onSuccess: (res) => {
      toast(`已分配 ${res.updated} 条`, 'success');
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
    onError: (err: Error) => toast(err.message || '操作失败', 'error'),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreFeedback(id),
    onSuccess: () => {
      toast('已恢复', 'success');
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
    onError: (err: Error) => toast(err.message || '恢复失败', 'error'),
  });

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!data?.items.length) return;
    if (selected.size === data.items.length) setSelected(new Set());
    else setSelected(new Set(data.items.map((i) => i.id)));
  };

  const activeChips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (projectFilter) {
    const project = projectList.find((p) => p.id === projectFilter);
    activeChips.push({
      key: 'project',
      label: project?.name ?? '项目',
      clear: () => setProjectFilter(''),
    });
  }
  if (assigneeFilter) {
    const assignee =
      assigneeFilter === '__unassigned__'
        ? null
        : memberList.find((m) => m.id === assigneeFilter);
    activeChips.push({
      key: 'assignee',
      label: assigneeFilter === '__unassigned__' ? '未分配' : `负责人：${assignee?.display_name ?? ''}`,
      clear: () => setAssigneeFilter(''),
    });
  }
  if (tagFilter) {
    const tag = tagList.find((tg) => tg.id === tagFilter);
    activeChips.push({ key: 'tag', label: `标签：${tag?.name ?? ''}`, clear: () => setTagFilter('') });
  }
  if (filters.status) {
    activeChips.push({
      key: 'status',
      label: t(`feedback.status_${filters.status}`),
      clear: () => {
        const next = { ...filters };
        delete next.status;
        setFilters(next);
      },
    });
  }
  if (filters.category) {
    activeChips.push({
      key: 'category',
      label: categoryLabel(filters.category, lang),
      clear: () => {
        const next = { ...filters };
        delete next.category;
        setFilters(next);
      },
    });
  }
  if (filters.priority) {
    activeChips.push({
      key: 'priority',
      label: `优先级：${priorityLabel(filters.priority as never, lang)}`,
      clear: () => {
        const next = { ...filters };
        delete next.priority;
        setFilters(next);
      },
    });
  }
  const hasActiveFilters =
    activeChips.length > 0 || Boolean(debouncedKeyword) || Boolean(projectFilter);

  const resetAll = () => {
    setFilters({});
    setProjectFilter('');
    setAssigneeFilter('');
    setTagFilter('');
    setKeyword('');
    setDebouncedKeyword('');
    setPage(1);
  };

  const applySavedView = (filtersValue: Record<string, string>) => {
    setFilters({ ...filtersValue });
    setProjectFilter(filtersValue.project_id ?? '');
    setAssigneeFilter(filtersValue.assignee_id ?? '');
    setTagFilter(filtersValue.tag_id ?? '');
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadFeedbackCsv({
        ...filters,
        ...(debouncedKeyword ? { keyword: debouncedKeyword } : {}),
      });
      toast('CSV 已开始下载', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '导出失败', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        title={t('feedback.list_title')}
        description={
          data
            ? `${t('feedback.total_count', { count: data.total })}${view === 'trash' ? ' · 回收站' : ''}`
            : t('common.loading')
        }
        actions={
          canExport ? (
            <Button variant="secondary" onClick={handleExport} disabled={exporting || isLoading}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 3v8m0 0 3-3m-3 3L7 8M4 14.5h12"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {exporting ? '导出中...' : t('feedback.export_csv')}
            </Button>
          ) : null
        }
      />

      {/* Toolbar */}
      <div className="rounded-xl border border-surface-3 bg-surface-0 p-3 shadow-card dark:border-gray-700/80 dark:bg-gray-800">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="relative w-full min-w-0 flex-1 lg:max-w-md lg:min-w-[260px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={keyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
              placeholder={t('feedback.search_placeholder')}
              data-shortcut-search
              className="h-9 w-full rounded-lg border border-surface-3 bg-surface-1/60 pl-9 pr-12 text-[13px] text-gray-900 placeholder:text-gray-400 transition-colors focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-brand-500"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-surface-3 bg-surface-0 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500 sm:block">
              /
            </kbd>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortBy);
                setPage(1);
              }}
              className={selectClass}
              aria-label="排序"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={projectFilter}
              onChange={(e) => {
                setProjectFilter(e.target.value);
                setPage(1);
              }}
              className={selectClass}
              aria-label="项目"
            >
              <option value="">全部项目</option>
              {projectList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={assigneeFilter}
              onChange={(e) => {
                setAssigneeFilter(e.target.value);
                setPage(1);
              }}
              className={selectClass}
              aria-label="负责人"
            >
              <option value="">全部负责人</option>
              <option value="__unassigned__">未分配</option>
              {currentMember && <option value={currentMember.id}>分配给我</option>}
              {memberList
                .filter((m) => m.id !== currentMember?.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
            </select>
            <select
              value={tagFilter}
              onChange={(e) => {
                setTagFilter(e.target.value);
                setPage(1);
              }}
              className={selectClass}
              aria-label="标签"
            >
              <option value="">全部标签</option>
              {tagList.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
            <FilterBar
              filters={filters}
              onChange={(f) => {
                setFilters(f);
                setPage(1);
              }}
            />

            <div className="ml-auto flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-surface-3 bg-surface-1/70 p-0.5 dark:border-gray-700 dark:bg-gray-900/40">
                {(
                  [
                    ['active', '全部反馈'],
                    ['trash', '回收站'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setView(key);
                      setPage(1);
                      setSelected(new Set());
                    }}
                    className={clsx(
                      'h-7 rounded-md px-2.5 text-xs font-medium transition-all',
                      view === key
                        ? 'bg-surface-0 text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                        : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="relative flex items-center gap-1">
                <select
                  value={activeSavedView}
                  onChange={(e) => {
                    const name = e.target.value;
                    setActiveSavedView(name);
                    const saved = savedViews.views.find((sv) => sv.name === name);
                    if (saved) applySavedView(saved.filters);
                  }}
                  className={selectClass}
                  aria-label="已保存视图"
                >
                  <option value="">视图</option>
                  {savedViews.views.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name}
                    </option>
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
                    className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:text-rose-500"
                  >
                    ✕
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowViewSaver((v) => !v);
                    setViewName('');
                  }}
                  title="保存当前筛选为视图"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-3 bg-surface-0 text-gray-500 transition-colors hover:bg-surface-1 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-brand-400"
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <path d="M3 2h8.5L13 4.5V14H3V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    <path d="M5 10h6v3H5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  </svg>
                </button>
                {showViewSaver && (
                  <div className="absolute right-0 top-full z-20 mt-1.5 w-56 animate-scale-in rounded-xl border border-surface-3 bg-surface-0 p-3 shadow-pop dark:border-gray-700 dark:bg-gray-800">
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
                          toast(
                            result === 'updated'
                              ? '已更新视图'
                              : result === 'saved'
                                ? '已保存视图'
                                : '保存失败（已达上限 10 个）',
                            result === 'limit' ? 'error' : 'success',
                          );
                        }
                      }}
                      className="h-9 w-full rounded-lg border border-surface-3 bg-surface-1/60 px-2.5 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100"
                    />
                    <Button
                      size="sm"
                      className="mt-2 w-full"
                      disabled={!viewName.trim()}
                      onClick={() => {
                        if (!viewName.trim()) return;
                        const result = savedViews.save(viewName, {
                          ...filters,
                          ...(projectFilter ? { project_id: projectFilter } : {}),
                          ...(assigneeFilter ? { assignee_id: assigneeFilter } : {}),
                          ...(tagFilter ? { tag_id: tagFilter } : {}),
                        });
                        setShowViewSaver(false);
                        toast(
                          result === 'updated'
                            ? '已更新视图'
                            : result === 'saved'
                              ? '已保存视图'
                              : '保存失败（已达上限 10 个）',
                          result === 'limit' ? 'error' : 'success',
                        );
                      }}
                    >
                      保存视图
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-surface-2 pt-2.5 dark:border-gray-700/60">
            <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">筛选</span>
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                onClick={chip.clear}
                className="group inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-surface-3 dark:bg-gray-700/60 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {chip.label}
                <span className="text-gray-400 group-hover:text-gray-600 dark:text-gray-500">✕</span>
              </button>
            ))}
            <button
              onClick={resetAll}
              className="ml-1 text-[11px] font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400"
            >
              重置筛选
            </button>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <FeedbackBulkBar
          count={selected.size}
          batchPending={batchMutation.isPending}
          assignPending={assignMutation.isPending}
          members={memberList}
          onClose={() => setSelected(new Set())}
          onBatchClose={() => batchMutation.mutate(Array.from(selected))}
          onAssign={(assigneeId) =>
            assignMutation.mutate({ ids: Array.from(selected), assigneeId })
          }
        />
      )}

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : !data?.items.length ? (
        view === 'trash' ? (
          <EmptyState
            icon={<SearchIcon className="text-gray-400" />}
            title="回收站为空"
            description="被删除的反馈会先进入回收站，可随时恢复"
          />
        ) : hasActiveFilters ? (
          <EmptyState
            icon={<SearchIcon className="text-gray-400" />}
            title="没有找到匹配的反馈"
            description="试试调整搜索关键词或清除部分筛选条件"
            action={{ label: '重置筛选', onClick: resetAll }}
          />
        ) : (
          <EmptyState
            icon={<SearchIcon className="text-gray-400" />}
            title={t('feedback.empty_title')}
            description={t('feedback.empty_desc')}
            action={
              firstProject
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
          <FeedbackTable
            items={data.items}
            selected={selected}
            view={view}
            restoring={restoreMutation.isPending}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
            onOpen={(id) => navigate(`/feedback/${id}`)}
            onRestore={(id) => restoreMutation.mutate(id)}
          />
          <FeedbackCards
            items={data.items}
            selected={selected}
            view={view}
            restoring={restoreMutation.isPending}
            onToggleSelect={toggleSelect}
            onOpen={(id) => navigate(`/feedback/${id}`)}
            onRestore={(id) => restoreMutation.mutate(id)}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={(next) => {
              setPage(next);
              setSelected(new Set());
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}
    </div>
  );
}
