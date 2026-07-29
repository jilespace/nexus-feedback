import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { Skeleton } from '@/components/Skeleton';
import type { OrgMember, OrgMemberRole } from '@/types';

const ROLE_LABELS: Record<OrgMemberRole, string> = {
  owner: '所有者',
  admin: '管理员',
  member: '成员',
};

const ROLE_COLORS: Record<OrgMemberRole, string> = {
  owner: 'bg-amber-100 text-amber-700',
  admin: 'bg-brand-100 text-brand-700',
  member: 'bg-gray-100 text-gray-600',
};

export function Members() {
  const { member: currentMember } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteDisplayName, setInviteDisplayName] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgMemberRole>('member');

  const { data, isLoading } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => apiRequest<{ items: OrgMember[]; total: number }>('/org/members'),
  });

  const members = data?.items;

  const inviteMutation = useMutation({
    mutationFn: (params: { email: string; password: string; display_name: string; role: OrgMemberRole }) =>
      apiRequest('/org/members', { method: 'POST', body: JSON.stringify(params) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      toast.show('成员邀请成功');
      setShowInvite(false);
      setInviteEmail('');
      setInvitePassword('');
      setInviteDisplayName('');
      setInviteRole('member');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '邀请失败', 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/org/members/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      toast.show('成员已移除');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '移除失败', 'error'),
  });

  const isOwner = currentMember?.role === 'owner';
  const canInvite = currentMember?.role === 'owner' || currentMember?.role === 'admin';

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" variant="rectangular" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">团队成员</h1>
        {canInvite && (
          <button onClick={() => setShowInvite(true)} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-200">
            邀请成员
          </button>
        )}
      </div>
      <div className="rounded-xl border border-surface-3 bg-surface-0 shadow-sm dark:border-gray-600 dark:bg-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-3 text-left dark:border-gray-600">
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">成员</th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">邮箱</th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">角色</th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">加入时间</th>
              {isOwner && <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">操作</th>}
            </tr>
          </thead>
          <tbody>
            {members?.map((m) => (
              <tr key={m.id} className="border-b border-surface-3 last:border-0 dark:border-gray-600">
                <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{m.display_name}</td>
                <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{m.email}</td>
                <td className="px-5 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[m.role]}`}>
                    {ROLE_LABELS[m.role]}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{new Date(m.created_at).toLocaleDateString()}</td>
                {isOwner && (
                  <td className="px-5 py-3">
                    {m.role !== 'owner' && (
                      <button onClick={() => removeMutation.mutate(m.id)} disabled={removeMutation.isPending} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">
                        移除
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl border border-surface-3 bg-surface-0 p-6 shadow-xl dark:border-gray-600 dark:bg-gray-800">
            <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">邀请成员</h2>
            <form
              onSubmit={(e) => { e.preventDefault(); inviteMutation.mutate({ email: inviteEmail, password: invitePassword, display_name: inviteDisplayName, role: inviteRole }); }}
              className="space-y-3"
            >
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="邮箱" required className="block w-full rounded-xl border border-surface-3 bg-surface-1 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              <input type="text" value={inviteDisplayName} onChange={(e) => setInviteDisplayName(e.target.value)} placeholder="显示名称" required className="block w-full rounded-xl border border-surface-3 bg-surface-1 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              <input type="password" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} placeholder="初始密码" required className="block w-full rounded-xl border border-surface-3 bg-surface-1 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as OrgMemberRole)} className="block w-full rounded-xl border border-surface-3 bg-surface-1 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                <option value="member">成员</option>
                <option value="admin">管理员</option>
              </select>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowInvite(false)} className="flex-1 rounded-xl border border-surface-3 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-surface-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">取消</button>
                <button type="submit" disabled={inviteMutation.isPending} className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{inviteMutation.isPending ? '邀请中...' : '邀请'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
