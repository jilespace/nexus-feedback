import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { Skeleton } from '@/components/Skeleton';
import type { OrgMember, OrgMemberRole } from '@/types';

type InviteResult = { id: string; email: string; role: string; invited: boolean; email_sent?: boolean; email_error?: string; invite_url?: string };
type ResendResult = { invited: boolean; email_sent: boolean; invite_url?: string };

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
  const [showInviteResult, setShowInviteResult] = useState(false);
  const [inviteResultUrl, setInviteResultUrl] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDisplayName, setInviteDisplayName] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgMemberRole>('member');

  const { data, isLoading } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => apiRequest<{ items: OrgMember[]; total: number }>('/org/members'),
  });

  const members = data?.items;

  const inviteMutation = useMutation({
    mutationFn: (params: { email: string; display_name: string; role: OrgMemberRole }) =>
      apiRequest<InviteResult>('/org/members', { method: 'POST', body: JSON.stringify(params) }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      if (result.email_sent) {
        toast.show('邀请邮件已发送');
        setShowInvite(false);
        setInviteEmail('');
        setInviteDisplayName('');
        setInviteRole('member');
      } else if (result.invite_url) {
        // Email send failed - show invite URL for manual delivery
        if (result.email_error) {
          toast.show(`邮件发送失败: ${result.email_error}`, 'error');
        }
        setInviteResultUrl(result.invite_url);
        setShowInviteResult(true);
      } else {
        toast.show('成员邀请成功');
        setShowInvite(false);
        setInviteEmail('');
        setInviteDisplayName('');
        setInviteRole('member');
      }
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '邀请失败', 'error'),
  });

  const resendInviteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<ResendResult>(`/org/members/${id}/resend-invite`, { method: 'POST' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      if (result.email_sent) {
        toast.show('邀请邮件已重发');
      } else if (result.invite_url) {
        setInviteResultUrl(result.invite_url);
        setShowInviteResult(true);
      }
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '重发失败', 'error'),
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
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">团队成员</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">邀请协作成员共同处理反馈，角色决定操作权限。</p>
        </div>
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
                  {m.pending && (
                    <span className="ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                      待激活
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{new Date(m.created_at).toLocaleDateString()}</td>
                {isOwner && (
                  <td className="px-5 py-3">
                    {m.role !== 'owner' && (
                      <div className="flex gap-2">
                        {m.pending && (
                          <>
                            <button
                              onClick={() => resendInviteMutation.mutate(m.id)}
                              disabled={resendInviteMutation.isPending}
                              className="text-xs text-brand-600 hover:text-brand-700 disabled:opacity-50"
                            >
                              重发邀请
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => removeMutation.mutate(m.id)}
                          disabled={removeMutation.isPending}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          移除
                        </button>
                      </div>
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
              onSubmit={(e) => { e.preventDefault(); inviteMutation.mutate({ email: inviteEmail, display_name: inviteDisplayName, role: inviteRole }); }}
              className="space-y-3"
            >
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="邮箱" required className="block w-full rounded-xl border border-surface-3 bg-surface-1 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              <input type="text" value={inviteDisplayName} onChange={(e) => setInviteDisplayName(e.target.value)} placeholder="显示名称" required className="block w-full rounded-xl border border-surface-3 bg-surface-1 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              <p className="text-xs text-gray-400 dark:text-gray-500">将通过邮件发送邀请链接，成员自行设置密码完成注册</p>
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
      {showInviteResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl border border-surface-3 bg-surface-0 p-6 shadow-xl dark:border-gray-600 dark:bg-gray-800">
            <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">邮件未配置，请手动分享链接</h2>
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">邀请链接（72小时有效）：</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteResultUrl}
                  readOnly
                  className="flex-1 rounded-xl border border-surface-3 bg-surface-1 px-4 py-2.5 text-sm text-gray-600 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(inviteResultUrl);
                    toast.show('已复制到剪贴板');
                  }}
                  className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
                >
                  复制链接
                </button>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">请将此链接发送给被邀请人，他们可通过链接设置密码完成激活</p>
              <button
                onClick={() => setShowInviteResult(false)}
                className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
