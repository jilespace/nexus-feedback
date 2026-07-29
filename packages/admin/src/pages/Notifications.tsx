import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { apiRequest } from '@/api/client';
import { useToast } from '@/components/Toast';
import { Skeleton } from '@/components/Skeleton';

type NotificationPref = {
  id: string;
  email: string;
  project_id: string;
  status_updates: boolean;
  weekly_digest: boolean;
  created_at: string;
};

export function Notifications() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['notification-preferences', projectId],
    queryFn: () => apiRequest<{ items: NotificationPref[]; total: number }>(`/org/projects/${projectId}/notifications`),
    enabled: !!projectId,
  });

  const updateMutation = useMutation({
    mutationFn: (params: { email: string; data: Partial<NotificationPref> }) =>
      apiRequest(`/org/projects/${projectId}/notifications/${encodeURIComponent(params.email)}`, {
        method: 'PUT',
        body: JSON.stringify(params.data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', projectId] });
      toast.show('偏好已更新');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '更新失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (email: string) =>
      apiRequest(`/org/projects/${projectId}/notifications/${encodeURIComponent(email)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', projectId] });
      toast.show('已删除');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '删除失败', 'error'),
  });

  const preferences = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">通知偏好</h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            管理订阅此项目通知的用户邮箱及其偏好设置。
          </p>
        </div>
        <Link
          to={`/projects/${projectId}/settings`}
          className="rounded-lg border border-surface-3 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-surface-1 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          返回项目设置
        </Link>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : preferences.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-surface-3 dark:border-gray-700">
          <table className="min-w-full divide-y divide-surface-3 text-left text-sm dark:divide-gray-700">
            <thead className="bg-surface-1 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">邮箱</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">状态更新</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">周报</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-3 dark:divide-gray-700">
              {preferences.map((pref) => (
                <tr key={pref.id} className="hover:bg-surface-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{pref.email}</td>
                  <td className="px-4 py-3">
                    <label className="inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={pref.status_updates}
                        onChange={(e) => updateMutation.mutate({ email: pref.email, data: { status_updates: e.target.checked } })}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="ml-2 text-xs text-gray-500">启用</span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={pref.weekly_digest}
                        onChange={(e) => updateMutation.mutate({ email: pref.email, data: { weekly_digest: e.target.checked } })}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="ml-2 text-xs text-gray-500">启用</span>
                    </label>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(pref.email)}
                      disabled={deleteMutation.isPending}
                      className="text-xs text-red-600 hover:text-red-700 disabled:opacity-60"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-surface-3 bg-surface-0 p-10 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">暂无通知偏好记录</p>
          <p className="mt-1 text-xs text-gray-400">当用户投票或提交反馈后，其通知偏好会自动创建。</p>
        </div>
      )}
    </div>
  );
}
