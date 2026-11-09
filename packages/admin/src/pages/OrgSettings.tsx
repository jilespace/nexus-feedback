import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { apiRequest } from '@/api/client';
import { useToast } from '@/components/Toast';
import { PageHeader } from '@/components/PageHeader';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  SectionCard,
  Skeleton,
  settingsInputClass,
} from '@/components/ui';

type OrgSettingsData = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
  board_url?: string | null;
};

type OrgForm = {
  name: string;
  logoUrl: string;
  brandColor: string;
  boardUrl: string;
};

type PasswordForm = {
  current: string;
  next: string;
  confirm: string;
};

type Translate = (key: string) => string;

const DEFAULT_BRAND_COLOR = '#3D5AFE';
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function orgFormFromData(data: OrgSettingsData): OrgForm {
  return {
    name: data.name ?? '',
    logoUrl: data.logo_url ?? '',
    brandColor: data.brand_color || DEFAULT_BRAND_COLOR,
    boardUrl: data.board_url ?? '',
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateOrgForm(form: OrgForm, t: Translate): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = t('org.profile.name.required');
  if (!HEX_COLOR_RE.test(form.brandColor.trim())) {
    errors.brandColor = t('common.colorInvalid');
  }
  if (form.boardUrl.trim() && !isHttpUrl(form.boardUrl.trim())) {
    errors.boardUrl = t('org.profile.boardUrl.invalid');
  }
  return errors;
}

function passwordPolicyError(value: string, t: Translate): string {
  if (!value) return t('org.password.next.required');
  if (value.length < 8) return t('org.password.next.tooShort');
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    return t('org.password.next.weak');
  }
  return '';
}

function SaveStatus({ dirty }: { dirty: boolean }) {
  const { t } = useTranslation('settings');
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">
      <span
        className={clsx('h-1.5 w-1.5 rounded-full', dirty ? 'bg-accent-500' : 'bg-emerald-500')}
      />
      {dirty ? t('common.dirty') : t('common.saved')}
    </span>
  );
}

export function OrgSettings() {
  const { t } = useTranslation('settings');
  const toast = useToast();
  const [form, setForm] = useState<OrgForm | null>(null);
  const [saved, setSaved] = useState<OrgForm | null>(null);
  const [orgErrors, setOrgErrors] = useState<Record<string, string>>({});
  const [password, setPassword] = useState<PasswordForm>({ current: '', next: '', confirm: '' });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => apiRequest<OrgSettingsData>('/org/settings'),
  });

  useEffect(() => {
    if (!data) return;
    const next = orgFormFromData(data);
    setForm(next);
    setSaved(next);
    setOrgErrors({});
  }, [data]);

  const settingsMutation = useMutation({
    mutationFn: (body: {
      name?: string;
      logo_url?: string;
      brand_color?: string;
      board_url?: string | null;
    }) => apiRequest('/org/settings', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: async () => {
      // Refetch instead of relying on cache invalidation: an unchanged payload keeps
      // the same query data reference and would leave the form marked as dirty.
      const result = await refetch();
      if (result.data) {
        const next = orgFormFromData(result.data);
        setForm(next);
        setSaved(next);
      }
      toast.show(t('org.savedToast'));
    },
    onError: (err) =>
      toast.show(err instanceof Error ? err.message : t('common.saveFailed'), 'error'),
  });

  const passwordMutation = useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      apiRequest('/org/change-password', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      setPassword({ current: '', next: '', confirm: '' });
      setPasswordErrors({});
      toast.show(t('org.password.changedToast'));
    },
    onError: (err) =>
      toast.show(err instanceof Error ? err.message : t('org.password.failedToast'), 'error'),
  });

  const dirty = !!form && !!saved && JSON.stringify(form) !== JSON.stringify(saved);

  const updateField = (key: keyof OrgForm, value: string) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setOrgErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSave = (event?: FormEvent) => {
    event?.preventDefault();
    if (!form) return;
    const errors = validateOrgForm(form, t);
    setOrgErrors(errors);
    if (Object.keys(errors).length > 0) return;
    settingsMutation.mutate({
      name: form.name.trim(),
      logo_url: form.logoUrl.trim() || undefined,
      brand_color: form.brandColor.trim(),
      board_url: form.boardUrl.trim() || null,
    });
  };

  const handleReset = () => {
    if (!saved) return;
    setForm(saved);
    setOrgErrors({});
  };

  const handleChangePassword = (event: FormEvent) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!password.current) errors.current = t('org.password.current.required');
    const policyError = passwordPolicyError(password.next, t);
    if (policyError) errors.next = policyError;
    if (!password.confirm) errors.confirm = t('org.password.confirm.required');
    else if (password.next !== password.confirm) {
      errors.confirm = t('org.password.confirm.mismatch');
    }
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;
    passwordMutation.mutate({
      current_password: password.current,
      new_password: password.next,
    });
  };

  const updatePassword = (key: keyof PasswordForm, value: string) => {
    setPassword((prev) => ({ ...prev, [key]: value }));
    setPasswordErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const headerActions = form ? (
    <>
      {dirty && <Badge tone="amber">{t('common.unsaved')}</Badge>}
      <Button variant="secondary" onClick={handleReset} disabled={!dirty}>
        {t('common.reset')}
      </Button>
      <Button
        type="submit"
        form="org-profile-form"
        disabled={!dirty || settingsMutation.isPending}
      >
        {settingsMutation.isPending ? t('common.saving') : t('org.saveAction')}
      </Button>
    </>
  ) : undefined;

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title={t('org.title')}
        description={t('org.description')}
        actions={headerActions}
      />

      {isError ? (
        <Card>
          <EmptyState
            icon={<WarningIcon />}
            title={t('org.loadErrorTitle')}
            description={error instanceof Error ? error.message : t('common.checkNetwork')}
            action={{ label: t('common.retry'), onClick: () => void refetch() }}
          />
        </Card>
      ) : isLoading || !form || !data ? (
        <div className="space-y-5">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <>
          <form id="org-profile-form" onSubmit={handleSave} noValidate>
            <SectionCard
              title={t('org.profile.title')}
              description={t('org.profile.description')}
              footer={
                <>
                  <SaveStatus dirty={dirty} />
                  <span className="text-[11px] text-gray-400 dark:text-gray-500">
                    {t('org.profile.footerHint')}
                  </span>
                </>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t('org.profile.name.label')}
                  htmlFor="org-name"
                  error={orgErrors.name}
                >
                  <input
                    id="org-name"
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    autoComplete="organization"
                    placeholder={t('org.profile.name.placeholder')}
                    className={settingsInputClass(!!orgErrors.name)}
                  />
                </Field>

                <Field
                  label={t('org.profile.slug.label')}
                  htmlFor="org-slug"
                  hint={t('org.profile.slug.hint')}
                >
                  <input
                    id="org-slug"
                    value={data.slug}
                    readOnly
                    className={clsx(settingsInputClass(), 'cursor-default font-mono text-xs')}
                  />
                </Field>

                <Field
                  label={t('org.profile.logo.label')}
                  htmlFor="org-logo"
                  hint={t('org.profile.logo.hint')}
                >
                  <input
                    id="org-logo"
                    value={form.logoUrl}
                    onChange={(e) => updateField('logoUrl', e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className={settingsInputClass()}
                  />
                </Field>

                <Field
                  label={t('org.profile.brandColor.label')}
                  htmlFor="org-brand-color"
                  error={orgErrors.brandColor}
                  hint={t('org.profile.brandColor.hint')}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={t('org.profile.brandColor.aria')}
                      value={HEX_COLOR_RE.test(form.brandColor) ? form.brandColor : DEFAULT_BRAND_COLOR}
                      onChange={(e) => updateField('brandColor', e.target.value)}
                      className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-surface-3 bg-surface-0 p-0.5 dark:border-gray-700 dark:bg-gray-800"
                    />
                    <input
                      id="org-brand-color"
                      value={form.brandColor}
                      onChange={(e) => updateField('brandColor', e.target.value)}
                      spellCheck={false}
                      className={clsx(settingsInputClass(!!orgErrors.brandColor), 'font-mono text-xs uppercase')}
                    />
                  </div>
                </Field>

                <Field
                  label={t('org.profile.boardUrl.label')}
                  htmlFor="org-board-url"
                  error={orgErrors.boardUrl}
                  hint={t('org.profile.boardUrl.hint')}
                  className="sm:col-span-2"
                >
                  <input
                    id="org-board-url"
                    value={form.boardUrl}
                    onChange={(e) => updateField('boardUrl', e.target.value)}
                    placeholder="https://feedback.example.com"
                    className={settingsInputClass(!!orgErrors.boardUrl)}
                  />
                </Field>

                <div className="rounded-lg border border-dashed border-surface-3 bg-surface-1/60 p-3 dark:border-gray-700 dark:bg-gray-900/30 sm:col-span-2">
                  <p className="mb-2 text-[11px] font-semibold tracking-[0.04em] text-gray-400 dark:text-gray-500">
                    {t('org.profile.preview.label')}
                  </p>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white shadow-sm"
                      style={{
                        backgroundColor: HEX_COLOR_RE.test(form.brandColor)
                          ? form.brandColor
                          : DEFAULT_BRAND_COLOR,
                      }}
                    >
                      {(form.name.trim().slice(0, 1) || 'N').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-gray-800 dark:text-gray-200">
                        {form.name.trim() || t('org.profile.preview.unnamed')}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                        {t('org.profile.preview.caption')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          </form>

          <SectionCard
            title={t('org.password.title')}
            description={t('org.password.description')}
          >
            <form onSubmit={handleChangePassword} noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t('org.password.current.label')}
                  htmlFor="current-password"
                  error={passwordErrors.current}
                >
                  <input
                    id="current-password"
                    type="password"
                    value={password.current}
                    onChange={(e) => updatePassword('current', e.target.value)}
                    autoComplete="current-password"
                    className={settingsInputClass(!!passwordErrors.current)}
                  />
                </Field>
                <div className="hidden sm:block" />
                <Field
                  label={t('org.password.next.label')}
                  htmlFor="new-password"
                  error={passwordErrors.next}
                  hint={passwordErrors.next ? undefined : t('org.password.next.hint')}
                >
                  <input
                    id="new-password"
                    type="password"
                    value={password.next}
                    onChange={(e) => updatePassword('next', e.target.value)}
                    autoComplete="new-password"
                    className={settingsInputClass(!!passwordErrors.next)}
                  />
                </Field>
                <Field
                  label={t('org.password.confirm.label')}
                  htmlFor="confirm-password"
                  error={passwordErrors.confirm}
                >
                  <input
                    id="confirm-password"
                    type="password"
                    value={password.confirm}
                    onChange={(e) => updatePassword('confirm', e.target.value)}
                    autoComplete="new-password"
                    className={settingsInputClass(!!passwordErrors.confirm)}
                  />
                </Field>
              </div>

              <PasswordRules value={password.next} />

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-surface-2 pt-4 dark:border-gray-700/60">
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  {t('org.password.hint')}
                </span>
                <Button type="submit" disabled={passwordMutation.isPending}>
                  {passwordMutation.isPending
                    ? t('org.password.submitting')
                    : t('org.password.submit')}
                </Button>
              </div>
            </form>
          </SectionCard>
        </>
      )}
    </div>
  );
}

function PasswordRules({ value }: { value: string }) {
  const { t } = useTranslation('settings');
  const rules = [
    { met: value.length >= 8, label: t('org.password.rules.length') },
    {
      met: /[a-z]/.test(value) && /[A-Z]/.test(value),
      label: t('org.password.rules.case'),
    },
    { met: /\d/.test(value), label: t('org.password.rules.number') },
  ];
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
      {rules.map((rule) => (
        <li
          key={rule.label}
          className={clsx(
            'inline-flex items-center gap-1.5 text-[11px] font-medium',
            rule.met
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-gray-400 dark:text-gray-500',
          )}
        >
          <span
            className={clsx(
              'flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] leading-none',
              rule.met
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                : 'bg-surface-2 text-gray-400 dark:bg-gray-700/60 dark:text-gray-500',
            )}
          >
            {rule.met ? '✓' : '·'}
          </span>
          {rule.label}
        </li>
      ))}
    </ul>
  );
}

function WarningIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 8v5m0 3.5h.01M10.3 3.9 2.7 17.2A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
