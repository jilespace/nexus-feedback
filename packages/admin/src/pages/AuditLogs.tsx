import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { fetchAuditLogs, fetchOrgMembers } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { Badge, Card, EmptyState, TableSkeleton } from '@/components/ui';
import { Pagination } from '@/components/feedback/Pagination';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import { auditActionLabel, auditActionTone, auditTargetLabel } from '@/utils/auditLabels';
import type { AuditLog, PaginatedResponse } from '@/types';

const ACTION_PREFIX_OPTIONS: Array<{ value: string; labelKey: string }> = [
  { value: '', labelKey: 'audit.page.filters.allTypes' },
  { value: 'feedback.', labelKey: 'audit.page.filters.feedback' },
  { value: 'reply.', labelKey: 'audit.page.filters.reply' },
  { value: 'comment.', labelKey: 'audit.page.filters.comment' },
  { value: 'member.', labelKey: 'audit.page.filters.member' },
  { value: 'project.', labelKey: 'audit.page.filters.project' },
  { value: 'webhook.', labelKey: 'audit.page.filters.webhook' },
];

const inputClass =
  'h-9 rounded-lg border border-surface-3 bg-surface-0 px-2.5 text-[13px] font-medium text-gray-600 transition-colors hover:border-gray-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600';

export function AuditLogs() {
  const { t } = useTranslation('content');
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
        title={t('audit.page.title')}
        description={t('audit.page.description')}
      />

      <div className="rounded-xl border border-surface-3 bg-surface-0 p-3 shadow-card dark:border-gray-700/80 dark:bg-gray-800">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={memberFilter}
            onChange={(e) => {
              setMemberFilter(e.target.value);
              setPage(1);
            }}
            aria-label={t('audit.page.filters.actorAria')}
            className={inputClass}
          >
            <option value="">{t('audit.page.filters.allMembers')}</option>
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
            aria-label={t('audit.page.filters.actionAria')}
            className={inputClass}
          >
            {ACTION_PREFIX_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
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
              aria-label={t('audit.page.filters.startAria')}
              className={clsx(inputClass, 'dark:[color-scheme:dark]')}
            />
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {t('audit.page.filters.to')}
            </span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              aria-label={t('audit.page.filters.endAria')}
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
                {t('audit.page.filters.clear')}
              </button>
            )}
          </div>

          {hasActiveFilter && (
            <button
              onClick={resetFilters}
              className="ml-auto inline-flex h-7 items-center gap-1 rounded-md bg-brand-50 px-2 text-[11px] font-medium text-brand-700 transition-colors hover:bg-brand-100 dark:bg-brand-600/15 dark:text-brand-300"
            >
              {t('audit.page.filters.reset')}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : !data?.items.length ? (
        <Card>
          <EmptyState
            title={
              hasActiveFilter
                ? t('audit.page.empty.noMatchTitle')
                : t('audit.page.empty.title')
            }
            description={
              hasActiveFilter
                ? t('audit.page.empty.noMatchDescription')
                : t('audit.page.empty.description')
            }
            action={
              hasActiveFilter
                ? { label: t('audit.page.empty.reset'), onClick: resetFilters }
                : undefined
            }
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="hidden grid-cols-[180px_minmax(0,1fr)_140px_120px] gap-4 border-b border-surface-2 bg-surface-1/70 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:border-gray-700/60 dark:bg-gray-800/60 dark:text-gray-500 md:grid">
              <span>{t('audit.page.table.action')}</span>
              <span>{t('audit.page.table.target')}</span>
              <span>{t('audit.page.table.actor')}</span>
              <span className="text-right">{t('audit.page.table.time')}</span>
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
                        <Badge tone={auditActionTone(log.action)}>
                          {auditActionLabel(log.action)}
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
                        <span>{auditTargetLabel(log.target_type)}</span>
                        {log.target_id && (
                          <code className="truncate rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-gray-400 dark:bg-gray-700/60 dark:text-gray-500">
                            {log.target_id.slice(0, 10)}
                          </code>
                        )}
                        {typeof log.metadata?.title === 'string' && (
                          <span className="truncate text-gray-400 dark:text-gray-500">
                            {t('audit.page.titleQuote', { title: log.metadata.title })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-gray-500 dark:bg-gray-700/60 dark:text-gray-400">
                          {(log.member?.display_name || t('audit.page.systemInitial')).slice(0, 1)}
                        </span>
                        {log.member?.display_name || t('audit.page.system')}
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
