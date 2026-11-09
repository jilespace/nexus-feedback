import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { fetchAuditLogs, fetchOrgMembers } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { Badge, Card, EmptyState, TableSkeleton } from '@/components/ui';
import { Pagination } from '@/components/feedback/Pagination';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import type { AuditLog, PaginatedResponse } from '@/types';

const ACTION_LABELS: Record<string, string> = {
  'feedback.create': '创建反馈',
  'feedback.update': '更新反馈',
  'feedback.status': '变更状态',
  'feedback.status_change': '变更状态',
  'feedback.delete': '删除反馈',
  'feedback.merge': '合并反馈',
  'feedback.assign': '指派反馈',
  'reply.create': '回复反馈',
  'comment.create': '添加评论',
  'comment.delete': '删除评论',
  'webhook.create': '创建 Webhook',
  'webhook.update': '更新 Webhook',
  'webhook.delete': '删除 Webhook',
  'member.invite': '邀请成员',
  'member.resend_invite': '重发邀请',
  'member.remove': '移除成员',
  'member.update_role': '变更角色',
  'project.create': '创建项目',
  'project.update': '更新项目',
  'project.delete': '删除项目',
  'project.regenerate_key': '重置 API Key',
};

const ACTION_PREFIX_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '全部类型' },
  { value: 'feedback.', label: '反馈类' },
  { value: 'reply.', label: '回复类' },
  { value: 'comment.', label: '评论类' },
  { value: 'member.', label: '成员类' },
  { value: 'project.', label: '项目类' },
  { value: 'webhook.', label: 'Webhook' },
];

type ActionTone = 'brand' | 'amber' | 'blue' | 'green' | 'gray' | 'violet';

function actionTone(action: string): ActionTone {
  if (action.startsWith('member.')) return 'amber';
  if (action.startsWith('project.')) return 'violet';
  if (action.startsWith('webhook.')) return 'blue';
  if (action.startsWith('reply.') || action.startsWith('comment.')) return 'green';
  if (action.startsWith('feedback.')) return 'brand';
  return 'gray';
}

function targetLabel(log: AuditLog): string {
  const typeLabels: Record<string, string> = {
    feedback: '反馈',
    member: '成员',
    project: '项目',
    webhook: 'Webhook',
    comment: '评论',
    changelog: '更新日志',
    category: '分类',
    status: '状态',
  };
  return typeLabels[log.target_type] ?? log.target_type;
}

const inputClass =
  'h-9 rounded-lg border border-surface-3 bg-surface-0 px-2.5 text-[13px] font-medium text-gray-600 transition-colors hover:border-gray-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600';

export function AuditLogs() {
  const [page, setPage] = useState(1);
  const [memberFilter, setMemberFilter] = useState('');
  const [actionPrefix, setActionPrefix] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: members } = useQuery({ queryKey: ['org-members'], queryFn: fetchOrgMembers });

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, memberFilter, actionPrefix, fromDate, toDate],
    queryFn: () =>
      fetchAuditLogs({
        page,
        page_size: 20,
        member_id: memberFilter || undefined,
        action_prefix: actionPrefix || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      }) as Promise<PaginatedResponse<AuditLog>>,
  });

  const hasActiveFilter = Boolean(memberFilter || actionPrefix || fromDate || toDate);

  const resetFilters = () => {
    setMemberFilter('');
    setActionPrefix('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="审计日志"
        description="记录组织内所有关键操作，包括成员变更与反馈处理，便于追溯。"
      />

      <div className="rounded-xl border border-surface-3 bg-surface-0 p-3 shadow-card dark:border-gray-700/80 dark:bg-gray-800">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={memberFilter}
            onChange={(e) => {
              setMemberFilter(e.target.value);
              setPage(1);
            }}
            aria-label="操作人"
            className={inputClass}
          >
            <option value="">全部成员</option>
            {(Array.isArray(members) ? members : []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>

          <select
            value={actionPrefix}
            onChange={(e) => {
              setActionPrefix(e.target.value);
              setPage(1);
            }}
            aria-label="操作类型"
            className={inputClass}
          >
            {ACTION_PREFIX_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              aria-label="开始日期"
              className={clsx(inputClass, 'dark:[color-scheme:dark]')}
            />
            <span className="text-xs text-gray-400 dark:text-gray-500">至</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              aria-label="结束日期"
              className={clsx(inputClass, 'dark:[color-scheme:dark]')}
            />
            {(fromDate || toDate) && (
              <button
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                  setPage(1);
                }}
                className="text-[11px] text-gray-400 transition-colors hover:text-rose-500"
              >
                清除
              </button>
            )}
          </div>

          {hasActiveFilter && (
            <button
              onClick={resetFilters}
              className="ml-auto inline-flex h-7 items-center gap-1 rounded-md bg-brand-50 px-2 text-[11px] font-medium text-brand-700 transition-colors hover:bg-brand-100 dark:bg-brand-600/15 dark:text-brand-300"
            >
              重置筛选
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : !data?.items.length ? (
        <Card>
          <EmptyState
            title={hasActiveFilter ? '没有匹配的审计记录' : '暂无审计记录'}
            description={hasActiveFilter ? '试试调整筛选条件' : '操作日志将会显示在这里'}
            action={hasActiveFilter ? { label: '重置筛选', onClick: resetFilters } : undefined}
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="hidden grid-cols-[180px_minmax(0,1fr)_140px_120px] gap-4 border-b border-surface-2 bg-surface-1/70 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:border-gray-700/60 dark:bg-gray-800/60 dark:text-gray-500 md:grid">
              <span>操作</span>
              <span>目标</span>
              <span>操作人</span>
              <span className="text-right">时间</span>
            </div>
            <ul className="divide-y divide-surface-2 dark:divide-gray-700/60">
              {data.items.map((log) => {
                const isOpen = expanded === log.id;
                const hasMeta = Boolean(log.metadata && Object.keys(log.metadata).length);
                return (
                  <li key={log.id}>
                    <button
                      onClick={() => hasMeta && setExpanded(isOpen ? null : log.id)}
                      className={clsx(
                        'flex w-full flex-col gap-2 px-5 py-3 text-left transition-colors md:grid md:grid-cols-[180px_minmax(0,1fr)_140px_120px] md:items-center md:gap-4',
                        hasMeta ? 'cursor-pointer hover:bg-surface-1/60 dark:hover:bg-gray-700/20' : 'cursor-default',
                        isOpen && 'bg-surface-1/40 dark:bg-gray-700/10',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Badge tone={actionTone(log.action)}>
                          {ACTION_LABELS[log.action] || log.action}
                        </Badge>
                        {hasMeta && (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 16 16"
                            fill="none"
                            className={clsx(
                              'text-gray-300 transition-transform dark:text-gray-600',
                              isOpen && 'rotate-180',
                            )}
                          >
                            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        )}
                      </div>
                      <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-gray-600 dark:text-gray-300">
                        <span>{targetLabel(log)}</span>
                        {log.target_id && (
                          <code className="truncate rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-gray-400 dark:bg-gray-700/60 dark:text-gray-500">
                            {log.target_id.slice(0, 10)}
                          </code>
                        )}
                        {typeof log.metadata?.title === 'string' && (
                          <span className="truncate text-gray-400 dark:text-gray-500">
                            「{log.metadata.title}」
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-gray-500 dark:bg-gray-700/60 dark:text-gray-400">
                          {(log.member?.display_name || '系').slice(0, 1)}
                        </span>
                        {log.member?.display_name || '系统'}
                      </div>
                      <div
                        className="text-[11px] text-gray-400 dark:text-gray-500 md:text-right"
                        title={new Date(log.created_at).toLocaleString()}
                      >
                        {formatRelativeTime(log.created_at)}
                      </div>
                    </button>
                    {isOpen && hasMeta && (
                      <div className="animate-fade-in border-t border-surface-2 bg-surface-1/40 px-5 py-3 dark:border-gray-700/60 dark:bg-gray-900/30">
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">
                          metadata
                        </p>
                        <pre className="overflow-x-auto rounded-lg bg-surface-0 p-3 font-mono text-[11px] leading-relaxed text-gray-600 ring-1 ring-surface-3 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
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
              setExpanded(null);
            }}
          />
        </>
      )}
    </div>
  );
}
