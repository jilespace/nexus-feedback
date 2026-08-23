import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogs, fetchOrgMembers } from '@/api/client';
import { EmptyState, TableSkeleton } from '@/components/ui';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import type { AuditLog, PaginatedResponse } from '@/types';

const ACTION_LABELS: Record<string, string> = {
  'feedback.create': '创建反馈',
  'feedback.update': '更新反馈',
  'feedback.delete': '删除反馈',
  'feedback.merge': '合并反馈',
  'feedback.assign': '指派反馈',
  'reply.create': '回复反馈',
  'comment.create': '添加评论',
  'webhook.create': '创建 Webhook',
  'webhook.update': '更新 Webhook',
  'member.invite': '邀请成员',
  'member.remove': '移除成员',
  'project.update': '更新项目',
};

const ACTION_PREFIX_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '全部' },
  { value: 'feedback.', label: '反馈类' },
  { value: 'member.', label: '成员类' },
  { value: 'system.', label: '系统类' },
  { value: 'project.', label: '项目类' },
];

export function AuditLogs() {
  const [page, setPage] = useState(1);
  const [memberFilter, setMemberFilter] = useState('');
  const [actionPrefix, setActionPrefix] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data: members } = useQuery({
    queryKey: ['org-members'],
    queryFn: fetchOrgMembers,
  });

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
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">审计日志</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">记录组织内所有关键操作，包括成员变更与反馈处理，便于追溯。</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={memberFilter}
          onChange={(e) => { setMemberFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
        >
          <option value="">全部成员</option>
          {(Array.isArray(members) ? members : []).map((m) => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </select>

        <select
          value={actionPrefix}
          onChange={(e) => { setActionPrefix(e.target.value); setPage(1); }}
          className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
        >
          {ACTION_PREFIX_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:[color-scheme:dark]"
          />
          <span className="text-sm text-gray-400 dark:text-gray-500">至</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:[color-scheme:dark]"
          />
          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(''); setToDate(''); setPage(1); }}
              className="text-xs text-gray-400 transition-colors hover:text-red-500 focus:outline-none"
            >
              清除
            </button>
          )}
        </div>

        {hasActiveFilter && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            筛选中
            <button
              onClick={resetFilters}
              className="text-brand-600 underline-offset-2 hover:underline dark:text-brand-400 focus:outline-none"
            >
              一键重置
            </button>
          </span>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : !data?.items.length ? (
        <EmptyState title="暂无审计记录" description="操作日志将会显示在这里" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-surface-3 bg-surface-0 dark:border-gray-700 dark:bg-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-surface-3 bg-surface-1 dark:border-gray-700 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">操作</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">目标</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">操作人</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-2 dark:divide-gray-700">
              {data.items.map((log) => (
                <tr key={log.id} className="hover:bg-surface-1 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {log.target_type}{log.target_id ? ` #${log.target_id.slice(0, 8)}` : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {log.member?.display_name || '系统'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {formatRelativeTime(log.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-2 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          >
            上一页
          </button>
          <span className="px-2 text-sm text-gray-600 dark:text-gray-400">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-2 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
