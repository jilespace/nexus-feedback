import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { Badge, Button, Card, EmptyState, Skeleton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { OrgMember, OrgMemberRole } from '@/types';

type InviteResult = {
  id: string;
  email: string;
  role: string;
  invited: boolean;
  email_sent?: boolean;
  email_error?: string;
  invite_url?: string;
};
type ResendResult = { invited: boolean; email_sent: boolean; invite_url?: string };

const ROLE_LABELS: Record<OrgMemberRole, string> = {
  owner: '所有者',
  admin: '管理员',
  member: '成员',
};

const ROLE_TONES: Record<OrgMemberRole, 'amber' | 'brand' | 'gray'> = {
  owner: 'amber',
  admin: 'brand',
  member: 'gray',
};

const ROLE_HINTS: Record<OrgMemberRole, string> = {
  owner: '全部权限，可管理组织设置与成员',
  admin: '可管理反馈、项目配置与成员',
  member: '可查看与处理反馈',
};

function avatarStyle(role: OrgMemberRole): string {
  if (role === 'owner') return 'from-accent-400 to-accent-600';
  if (role === 'admin') return 'from-brand-400 to-brand-600';
  return 'from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700';
}

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
  const [confirmRemove, setConfirmRemove] = useState<OrgMember | null>(null);
  const [roleChange, setRoleChange] = useState<{ member: OrgMember; role: OrgMemberRole } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const { data, isLoading } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => apiRequest<{ items: OrgMember[]; total: number }>('/org/members'),
  });

  const members = data?.items ?? [];

  const inviteMutation = useMutation({
    mutationFn: (params: { email: string; display_name: string; role: OrgMemberRole }) =>
      apiRequest<InviteResult>('/org/members', { method: 'POST', body: JSON.stringify(params) }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      setShowInvite(false);
      setInviteEmail('');
      setInviteDisplayName('');
      setInviteRole('member');
      if (result.email_sent) {
        toast.show('邀请邮件已发送');
      } else if (result.invite_url) {
        if (result.email_error) toast.show(`邮件发送失败：${result.email_error}`, 'error');
        setInviteResultUrl(result.invite_url);
        setShowInviteResult(true);
      } else {
        toast.show('成员邀请成功');
      }
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '邀请失败', 'error'),
  });

  const resendInviteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<ResendResult>(`/org/members/${id}/resend-invite`, { method: 'POST' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      if (result.email_sent) toast.show('邀请邮件已重发');
      else if (result.invite_url) {
        setInviteResultUrl(result.invite_url);
        setShowInviteResult(true);
      }
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '重发失败', 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/org/members/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      setConfirmRemove(null);
      toast.show('成员已移除');
    },
    onError: (err) => {
      setConfirmRemove(null);
      toast.show(err instanceof Error ? err.message : '移除失败', 'error');
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: OrgMemberRole }) =>
      apiRequest(`/org/members/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      setRoleChange(null);
      toast.show('角色已更新');
    },
    onError: (err) => {
      setRoleChange(null);
      toast.show(err instanceof Error ? err.message : '角色更新失败', 'error');
    },
  });

  const isOwner = currentMember?.role === 'owner';
  const canInvite = currentMember?.role === 'owner' || currentMember?.role === 'admin';

  useEffect(() => {
    if (searchParams.get('invite') === '1' && canInvite) {
      setShowInvite(true);
      const next = new URLSearchParams(searchParams);
      next.delete('invite');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, canInvite]);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteResultUrl);
      toast.show('已复制到剪贴板');
    } catch {
      toast.show('复制失败', 'error');
    }
  };

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="团队成员"
        description="邀请协作成员共同处理反馈，角色决定操作权限。"
        actions={
          canInvite ? (
            <Button onClick={() => setShowInvite(true)}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              邀请成员
            </Button>
          ) : null
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <Card>
          <EmptyState title="暂无成员" description="邀请同事加入，一起处理用户反馈" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,2fr)_140px_120px_160px] gap-4 border-b border-surface-2 bg-surface-1/70 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:border-gray-700/60 dark:bg-gray-800/60 dark:text-gray-500 md:grid">
            <span>成员</span>
            <span>角色</span>
            <span>加入时间</span>
            <span className="text-right">操作</span>
          </div>
          <ul className="divide-y divide-surface-2 dark:divide-gray-700/60">
            {members.map((member) => {
              const isSelf = member.id === currentMember?.id;
              return (
                <li
                  key={member.id}
                  className="flex flex-col gap-3 px-5 py-3.5 transition-colors hover:bg-surface-1/60 md:grid md:grid-cols-[minmax(0,2fr)_140px_120px_160px] md:items-center md:gap-4 dark:hover:bg-gray-700/20"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[13px] font-semibold text-white ${avatarStyle(member.role)}`}
                    >
                      {(member.display_name || member.email).slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                          {member.display_name || member.email.split('@')[0]}
                        </p>
                        {isSelf && <Badge tone="brand">我</Badge>}
                        {member.pending && <Badge tone="amber">待激活</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
                        {member.email}
                      </p>
                    </div>
                  </div>

                  <div>
                    {isOwner && member.role !== 'owner' && !member.pending ? (
                      <select
                        value={member.role}
                        onChange={(e) => {
                          const role = e.target.value as OrgMemberRole;
                          if (role !== member.role) setRoleChange({ member, role });
                        }}
                        className="h-7 rounded-md border border-surface-3 bg-surface-0 px-1.5 text-xs font-medium text-gray-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      >
                        <option value="member">成员</option>
                        <option value="admin">管理员</option>
                      </select>
                    ) : (
                      <Badge tone={ROLE_TONES[member.role]}>{ROLE_LABELS[member.role]}</Badge>
                    )}
                  </div>

                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(member.created_at).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-1 md:justify-end">
                    {member.pending && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={resendInviteMutation.isPending}
                        onClick={() => resendInviteMutation.mutate(member.id)}
                      >
                        重发邀请
                      </Button>
                    )}
                    {isOwner && member.role !== 'owner' && !isSelf && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                        onClick={() => setConfirmRemove(member)}
                      >
                        移除
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        角色权限：所有者可管理组织与成员；管理员可管理项目配置与成员；成员可查看与处理反馈。
      </p>

      {showInvite && (
        <Modal
          title="邀请成员"
          description="邀请链接有效期 72 小时，成员通过链接设置密码后即可加入。"
          onClose={() => setShowInvite(false)}
          size="md"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setShowInvite(false)}>
                取消
              </Button>
              <Button
                size="sm"
                type="submit"
                form="invite-member-form"
                disabled={inviteMutation.isPending}
              >
                {inviteMutation.isPending ? '邀请中...' : '发送邀请'}
              </Button>
            </>
          }
        >
          <form
            id="invite-member-form"
            onSubmit={(e) => {
              e.preventDefault();
              inviteMutation.mutate({
                email: inviteEmail.trim(),
                display_name: inviteDisplayName.trim(),
                role: inviteRole,
              });
            }}
            className="space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">
                邮箱 <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                required
                autoFocus
                className="h-9 w-full rounded-lg border border-surface-3 bg-surface-1/60 px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">
                显示名称 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={inviteDisplayName}
                onChange={(e) => setInviteDisplayName(e.target.value)}
                placeholder="例如：产品-小林"
                required
                className="h-9 w-full rounded-lg border border-surface-3 bg-surface-1/60 px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">
                角色
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {(['member', 'admin'] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setInviteRole(role)}
                    className={
                      inviteRole === role
                        ? 'rounded-lg border border-brand-400 bg-brand-50/70 px-3 py-2 text-left ring-1 ring-brand-200 dark:border-brand-500/50 dark:bg-brand-600/15 dark:ring-brand-500/20'
                        : 'rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-left hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
                    }
                  >
                    <p className="text-[13px] font-medium text-gray-800 dark:text-gray-100">
                      {ROLE_LABELS[role]}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                      {ROLE_HINTS[role]}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </form>
        </Modal>
      )}

      {showInviteResult && (
        <Modal
          title="邮件未配置，请手动分享邀请链接"
          description="系统尚未配置邮件服务，可复制下方链接直接发送给被邀请人。"
          onClose={() => setShowInviteResult(false)}
          size="md"
          footer={
            <Button size="sm" onClick={() => setShowInviteResult(false)}>
              完成
            </Button>
          }
        >
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">
            邀请链接（72 小时有效）
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={inviteResultUrl}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              className="h-9 min-w-0 flex-1 rounded-lg border border-surface-3 bg-surface-1/60 px-3 font-mono text-xs text-gray-600 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300"
            />
            <Button size="sm" onClick={copyInvite}>
              复制链接
            </Button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
            被邀请人打开链接并设置密码后会自动加入组织。也可在「系统配置」中配置邮件服务以自动发送邀请。
          </p>
        </Modal>
      )}

      {confirmRemove && (
        <Modal
          title="移除成员"
          description={`确定将「${confirmRemove.display_name || confirmRemove.email}」移出当前组织吗？`}
          onClose={() => setConfirmRemove(null)}
          size="sm"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setConfirmRemove(null)}>
                取消
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(confirmRemove.id)}
              >
                {removeMutation.isPending ? '移除中...' : '确认移除'}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            移除后该成员将无法再访问本组织的反馈与配置，其历史操作记录会保留。
          </p>
        </Modal>
      )}

      {roleChange && (
        <Modal
          title="变更成员角色"
          description={`将「${roleChange.member.display_name || roleChange.member.email}」的角色改为${ROLE_LABELS[roleChange.role]}。`}
          onClose={() => setRoleChange(null)}
          size="sm"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setRoleChange(null)}>
                取消
              </Button>
              <Button
                size="sm"
                disabled={roleMutation.isPending}
                onClick={() => roleMutation.mutate({ id: roleChange.member.id, role: roleChange.role })}
              >
                {roleMutation.isPending ? '保存中...' : '确认变更'}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {ROLE_HINTS[roleChange.role]}。角色变更会立即生效。
          </p>
        </Modal>
      )}
    </div>
  );
}
