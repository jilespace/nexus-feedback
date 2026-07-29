import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';
import type { WebhookLog, PaginatedResponse } from '@/types';

export function WebhookLogs({ webhookId, projectId }: { webhookId: string; projectId: string }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['webhook-logs', webhookId, page],
    queryFn: () => apiRequest<PaginatedResponse<WebhookLog>>(
      `/org/projects/${projectId}/webhooks/${webhookId}/logs?page=${page}&page_size=10`
    ),
    enabled: !!webhookId,
  });

  if (isLoading) return <p className="text-sm text-gray-400">加载中...</p>;
  if (!data?.items.length) return <p className="text-sm text-gray-400 py-4 text-center">暂无日志</p>;

  return (
    <div className="mt-3 space-y-2">
      {data.items.map((log) => (
        <div key={log.id} className="rounded-lg border border-surface-3 px-4 py-3 text-xs dark:border-gray-600">
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center rounded px-2 py-0.5 font-medium ${log.success ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
              {log.success ? '成功' : '失败'}
            </span>
            <span className="text-gray-400">{new Date(log.created_at).toLocaleString('zh-CN')}</span>
          </div>
          <div className="mt-1 text-gray-600 dark:text-gray-400">
            <span className="font-medium">{log.event}</span>
            {log.status_code && <span className="ml-2 text-gray-400">HTTP {log.status_code}</span>}
            <span className="ml-2 text-gray-400">尝试 {log.attempts} 次</span>
          </div>
          {log.error && <p className="mt-1 text-red-600 dark:text-red-400">{log.error}</p>}
        </div>
      ))}
      {data.total > 10 && (
        <div className="flex justify-center gap-2 pt-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded border border-surface-3 px-3 py-1 text-xs disabled:opacity-40 hover:bg-surface-2 dark:border-gray-600 dark:text-gray-300">上一页</button>
          <span className="px-2 text-xs text-gray-500">{page} / {Math.ceil(data.total / 10)}</span>
          <button disabled={page >= Math.ceil(data.total / 10)} onClick={() => setPage(p => p + 1)} className="rounded border border-surface-3 px-3 py-1 text-xs disabled:opacity-40 hover:bg-surface-2 dark:border-gray-600 dark:text-gray-300">下一页</button>
        </div>
      )}
    </div>
  );
}
