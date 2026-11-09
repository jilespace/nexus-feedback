import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { Badge, Button, Card, EmptyState, Field, Skeleton, settingsInputClass } from '@/components/ui';
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

const ROLE_TONES: Record<OrgMemberRole, 'amber' | 'brand' | 'gray'> = {
  owner: 'amber',
  admin: 'brand',
  member: 'gray',
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
  const { t, i18n } = useTranslation('team');
  const [showInvite, setShowInvite] = useState(false);
  const [showInviteResult, setShowInviteResult] = useState(false);
  const [inviteResultUrl, setInviteResultUrl] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDisplayName, setInviteDisplayName] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgMemberRole>('member');
  const [confirmRemove, setConfirmRemove] = useState<OrgMember | null>(null);
  const [roleChange, setRoleChange] = useState<{ member: OrgMember; role: OrgMemberRole } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const roleLabels: Record<OrgMemberRole, string> = {
    owner: t('translation:members.role_owner'),
    admin: t('translation:members.role_admin'),
    member: t('translation:members.role_member'),
  };

  const roleHints: Record<OrgMemberRole, string> = {
    owner: t('members.roleHints.owner'),
    admin: t('members.roleHints.admin'),
    member: t('members.roleHints.member'),
  };

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
        toast.show(t('members.toast.inviteEmailSent'));
      } else if (result.invite_url) {
        if (result.email_error) {
          toast.show(t('members.toast.inviteEmailFailed', { message: result.email_error }), 'error');
        }
        setInviteResultUrl(result.invite_url);
        setShowInviteResult(true);
      } else {
        toast.show(t('members.toast.inviteSuccess'));
      }
    },
    onError: (err) =>
      toast.show(err instanceof Error ? err.message : t('members.toast.inviteFailed'), 'error'),
  });

  const resendInviteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<ResendResult>(`/org/members/${id}/resend-invite`, { method: 'POST' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      if (result.email_sent) toast.show(t('members.toast.resendEmailSent'));
      else if (result.invite_url) {
        setInviteResultUrl(result.invite_url);
        setShowInviteResult(true);
      }
    },
    onError: (err) =>
      toast.show(err instanceof Error ? err.message : t('members.toast.resendFailed'), 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/org/members/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      setConfirmRemove(null);
      toast.show(t('members.toast.removed'));
    },
    onError: (err) => {
      setConfirmRemove(null);
      toast.show(err instanceof Error ? err.message : t('members.toast.removeFailed'), 'error');
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: OrgMemberRole }) =>
      apiRequest(`/org/members/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      setRoleChange(null);
      toast.show(t('members.toast.roleUpdated'));
    },
    onError: (err) => {
      setRoleChange(null);
      toast.show(err instanceof Error ? err.message : t('members.toast.roleUpdateFailed'), 'error');
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
      toast.show(t('members.toast.copied'));
    } catch {
      toast.show(t('members.toast.copyFailed'), 'error');
    }
  };

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title={t('members.title')}
        description={t('members.description')}
        actions={
          canInvite ? (
            <Button onClick={() => setShowInvite(true)}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              {t('members.invite')}
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
          <EmptyState
            title={t('members.emptyTitle')}
            description={t('members.emptyDescription')}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,2fr)_140px_120px_160px] gap-4 border-b border-surface-2 bg-surface-1/70 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 dark:border-gray-700/60 dark:bg-gray-800/60 dark:text-gray-500 md:grid">
            <span>{t('members.columns.member')}</span>
            <span>{t('members.columns.role')}</span>
            <span>{t('members.columns.joinedAt')}</span>
            <span className="text-right">{t('members.columns.actions')}</span>
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
                        {isSelf && <Badge tone="brand">{t('members.selfBadge')}</Badge>}
                        {member.pending && <Badge tone="amber">{t('members.pendingBadge')}</Badge>}
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
                        aria-label={t('members.roleAria', {
                          name: member.display_name || member.email,
                        })}
                        onChange={(e) => {
                          const role = e.target.value as OrgMemberRole;
                          if (role !== member.role) setRoleChange({ member, role });
                        }}
                        className="h-7 rounded-md border border-surface-3 bg-surface-0 px-1.5 text-xs font-medium text-gray-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      >
                        <option value="member">{t('translation:members.role_member')}</option>
                        <option value="admin">{t('translation:members.role_admin')}</option>
                      </select>
                    ) : (
                      <Badge tone={ROLE_TONES[member.role]}>{roleLabels[member.role]}</Badge>
                    )}
                  </div>

                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(member.created_at).toLocaleDateString(
                      i18n.language.startsWith('en') ? 'en-US' : 'zh-CN',
                    )}
                  </span>

                  <div className="flex items-center gap-1 md:justify-end">
                    {member.pending && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={resendInviteMutation.isPending}
                        onClick={() => resendInviteMutation.mutate(member.id)}
                      >
                        {t('members.resend')}
                      </Button>
                    )}
                    {isOwner && member.role !== 'owner' && !isSelf && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                        onClick={() => setConfirmRemove(member)}
                      >
                        {t('members.remove')}
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
        {t('members.rolePermissions')}
      </p>

      {showInvite && (
        <Modal
          title={t('members.inviteModal.title')}
          description={t('members.inviteModal.description')}
          onClose={() => setShowInvite(false)}
          size="md"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setShowInvite(false)}>
                {t('members.inviteModal.cancel')}
              </Button>
              <Button
                size="sm"
                type="submit"
                form="invite-member-form"
                disabled={inviteMutation.isPending}
              >
                {inviteMutation.isPending
                  ? t('members.inviteModal.submitting')
                  : t('members.inviteModal.submit')}
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
            <Field label={t('members.inviteModal.email')} htmlFor="invite-email" required>
              <input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                required
                autoFocus
                className={settingsInputClass()}
              />
            </Field>
            <Field label={t('members.inviteModal.displayName')} htmlFor="invite-display-name" required>
              <input
                id="invite-display-name"
                type="text"
                value={inviteDisplayName}
                onChange={(e) => setInviteDisplayName(e.target.value)}
                placeholder={t('members.inviteModal.displayNamePlaceholder')}
                required
                className={settingsInputClass()}
              />
            </Field>
            <Field label={t('members.inviteModal.role')}>
              <div className="grid gap-2 sm:grid-cols-2">
                {(['member', 'admin'] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setInviteRole(role)}
                    aria-pressed={inviteRole === role}
                    className={
                      inviteRole === role
                        ? 'rounded-lg border border-brand-400 bg-brand-50/70 px-3 py-2 text-left ring-1 ring-brand-200 dark:border-brand-500/50 dark:bg-brand-600/15 dark:ring-brand-500/20'
                        : 'rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-left hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
                    }
                  >
                    <p className="text-[13px] font-medium text-gray-800 dark:text-gray-100">
                      {roleLabels[role]}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                      {roleHints[role]}
                    </p>
                  </button>
                ))}
              </div>
            </Field>
          </form>
        </Modal>
      )}

      {showInviteResult && (
        <Modal
          title={t('members.inviteResultModal.title')}
          description={t('members.inviteResultModal.description')}
          onClose={() => setShowInviteResult(false)}
          size="md"
          footer={
            <Button size="sm" onClick={() => setShowInviteResult(false)}>
              {t('members.inviteResultModal.done')}
            </Button>
          }
        >
          <Field
            label={t('members.inviteResultModal.linkLabel')}
            hint={t('members.inviteResultModal.linkHint')}
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteResultUrl}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                aria-label={t('members.inviteResultModal.linkAria')}
                className={`${settingsInputClass()} min-w-0 flex-1 font-mono`}
              />
              <Button size="sm" onClick={copyInvite}>
                {t('members.inviteResultModal.copy')}
              </Button>
            </div>
          </Field>
        </Modal>
      )}

      {confirmRemove && (
        <Modal
          title={t('members.removeModal.title')}
          description={t('members.removeModal.description', {
            name: confirmRemove.display_name || confirmRemove.email,
          })}
          onClose={() => setConfirmRemove(null)}
          size="sm"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setConfirmRemove(null)}>
                {t('members.removeModal.cancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(confirmRemove.id)}
              >
                {removeMutation.isPending
                  ? t('members.removeModal.submitting')
                  : t('members.removeModal.confirm')}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {t('members.removeModal.body')}
          </p>
        </Modal>
      )}

      {roleChange && (
        <Modal
          title={t('members.roleChangeModal.title')}
          description={t('members.roleChangeModal.description', {
            name: roleChange.member.display_name || roleChange.member.email,
            role: roleLabels[roleChange.role],
          })}
          onClose={() => setRoleChange(null)}
          size="sm"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setRoleChange(null)}>
                {t('members.roleChangeModal.cancel')}
              </Button>
              <Button
                size="sm"
                disabled={roleMutation.isPending}
                onClick={() => roleMutation.mutate({ id: roleChange.member.id, role: roleChange.role })}
              >
                {roleMutation.isPending
                  ? t('members.roleChangeModal.submitting')
                  : t('members.roleChangeModal.confirm')}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {t('members.roleChangeModal.body', {
              hint: roleHints[roleChange.role],
            })}
          </p>
        </Modal>
      )}
    </div>
  );
}
