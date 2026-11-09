import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { apiRequest } from '@/api/client';
import { useToast } from '@/components/Toast';
import { PageHeader } from '@/components/PageHeader';
import { Badge, Button, Card, CardHeader, EmptyState, Skeleton } from '@/components/ui';

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

function validateOrgForm(form: OrgForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = '请输入组织名称';
  if (!HEX_COLOR_RE.test(form.brandColor.trim())) errors.brandColor = '请输入 #RRGGBB 格式的颜色值';
  if (form.boardUrl.trim() && !isHttpUrl(form.boardUrl.trim())) {
    errors.boardUrl = '请输入以 http:// 或 https:// 开头的完整地址';
  }
  return errors;
}

function passwordPolicyError(value: string): string {
  if (!value) return '请输入新密码';
  if (value.length < 8) return '新密码至少 8 位';
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    return '需包含大小写字母和数字';
  }
  return '';
}

const inputClass = (invalid = false) =>
  clsx(
    'h-9 w-full rounded-lg border px-3 text-[13px] text-gray-900 placeholder:text-gray-400 transition-colors focus:bg-surface-0 focus:outline-none focus:ring-2 dark:text-gray-100',
    invalid
      ? 'border-rose-400 bg-rose-50/40 focus:border-rose-400 focus:ring-rose-500/15 dark:border-rose-500/70 dark:bg-rose-500/5'
      : 'border-surface-3 bg-surface-1/60 focus:border-brand-400 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900/40',
  );

function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[11px] font-semibold tracking-[0.04em] text-gray-500 dark:text-gray-400"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}

function SettingsCard({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="border-b border-surface-2 px-5 py-4 dark:border-gray-700/60">
        <CardHeader title={title} description={description} />
      </div>
      <div className="p-5">{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-2 px-5 py-3 dark:border-gray-700/60">
          {footer}
        </div>
      )}
    </Card>
  );
}

function SaveStatus({ dirty }: { dirty: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">
      <span
        className={clsx('h-1.5 w-1.5 rounded-full', dirty ? 'bg-accent-500' : 'bg-emerald-500')}
      />
      {dirty ? '有未保存的更改' : '所有更改已保存'}
    </span>
  );
}

export function OrgSettings() {
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
      toast.show('组织设置已保存');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '保存失败', 'error'),
  });

  const passwordMutation = useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      apiRequest('/org/change-password', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      setPassword({ current: '', next: '', confirm: '' });
      setPasswordErrors({});
      toast.show('密码已修改');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '修改失败', 'error'),
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
    const errors = validateOrgForm(form);
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
    if (!password.current) errors.current = '请输入当前密码';
    const policyError = passwordPolicyError(password.next);
    if (policyError) errors.next = policyError;
    if (!password.confirm) errors.confirm = '请再次输入新密码';
    else if (password.next !== password.confirm) errors.confirm = '两次输入的密码不一致';
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
      {dirty && <Badge tone="amber">未保存</Badge>}
      <Button variant="secondary" onClick={handleReset} disabled={!dirty}>
        重置
      </Button>
      <Button
        type="submit"
        form="org-profile-form"
        disabled={!dirty || settingsMutation.isPending}
      >
        {settingsMutation.isPending ? '保存中...' : '保存更改'}
      </Button>
    </>
  ) : undefined;

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="组织设置"
        description="管理组织名称、品牌展示与公开看板地址，并维护当前账号的登录密码。"
        actions={headerActions}
      />

      {isError ? (
        <Card>
          <EmptyState
            icon={<WarningIcon />}
            title="加载组织设置失败"
            description={error instanceof Error ? error.message : '请检查网络后重试。'}
            action={{ label: '重试', onClick: () => void refetch() }}
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
            <SettingsCard
              title="组织资料"
              description="这些信息会展示在公开看板、邮件通知与登录页。"
              footer={
                <>
                  <SaveStatus dirty={dirty} />
                  <span className="text-[11px] text-gray-400 dark:text-gray-500">
                    修改后点击右上角「保存更改」生效
                  </span>
                </>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="组织名称" htmlFor="org-name" error={orgErrors.name}>
                  <input
                    id="org-name"
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    autoComplete="organization"
                    placeholder="例如：Nexus"
                    className={inputClass(!!orgErrors.name)}
                  />
                </Field>

                <Field
                  label="组织标识"
                  htmlFor="org-slug"
                  hint="用于登录与公开链接，创建后不可修改。"
                >
                  <input
                    id="org-slug"
                    value={data.slug}
                    readOnly
                    className={clsx(inputClass(), 'cursor-default font-mono text-xs')}
                  />
                </Field>

                <Field
                  label="Logo 地址"
                  htmlFor="org-logo"
                  hint="留空则使用品牌色首字母作为头像。"
                >
                  <input
                    id="org-logo"
                    value={form.logoUrl}
                    onChange={(e) => updateField('logoUrl', e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className={inputClass()}
                  />
                </Field>

                <Field
                  label="品牌颜色"
                  htmlFor="org-brand-color"
                  error={orgErrors.brandColor}
                  hint="用于公开看板的主色与品牌标识。"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="选择品牌颜色"
                      value={HEX_COLOR_RE.test(form.brandColor) ? form.brandColor : DEFAULT_BRAND_COLOR}
                      onChange={(e) => updateField('brandColor', e.target.value)}
                      className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-surface-3 bg-surface-0 p-0.5 dark:border-gray-700 dark:bg-gray-800"
                    />
                    <input
                      id="org-brand-color"
                      value={form.brandColor}
                      onChange={(e) => updateField('brandColor', e.target.value)}
                      spellCheck={false}
                      className={clsx(inputClass(!!orgErrors.brandColor), 'font-mono text-xs uppercase')}
                    />
                  </div>
                </Field>

                <Field
                  label="公开看板地址"
                  htmlFor="org-board-url"
                  error={orgErrors.boardUrl}
                  hint="留空则自动使用当前域名：https://你的域名/{项目 slug}"
                  className="sm:col-span-2"
                >
                  <input
                    id="org-board-url"
                    value={form.boardUrl}
                    onChange={(e) => updateField('boardUrl', e.target.value)}
                    placeholder="https://feedback.example.com"
                    className={inputClass(!!orgErrors.boardUrl)}
                  />
                </Field>

                <div className="rounded-lg border border-dashed border-surface-3 bg-surface-1/60 p-3 dark:border-gray-700 dark:bg-gray-900/30 sm:col-span-2">
                  <p className="mb-2 text-[11px] font-semibold tracking-[0.04em] text-gray-400 dark:text-gray-500">
                    品牌预览
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
                        {form.name.trim() || '未命名组织'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                        公开看板与邮件中的品牌展示
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </SettingsCard>
          </form>

          <SettingsCard
            title="修改密码"
            description="修改后请使用新密码登录，其它设备上的会话不会自动登出。"
          >
            <form onSubmit={handleChangePassword} noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="当前密码" htmlFor="current-password" error={passwordErrors.current}>
                  <input
                    id="current-password"
                    type="password"
                    value={password.current}
                    onChange={(e) => updatePassword('current', e.target.value)}
                    autoComplete="current-password"
                    className={inputClass(!!passwordErrors.current)}
                  />
                </Field>
                <div className="hidden sm:block" />
                <Field
                  label="新密码"
                  htmlFor="new-password"
                  error={passwordErrors.next}
                  hint={passwordErrors.next ? undefined : '至少 8 位，需包含大小写字母和数字。'}
                >
                  <input
                    id="new-password"
                    type="password"
                    value={password.next}
                    onChange={(e) => updatePassword('next', e.target.value)}
                    autoComplete="new-password"
                    className={inputClass(!!passwordErrors.next)}
                  />
                </Field>
                <Field label="确认新密码" htmlFor="confirm-password" error={passwordErrors.confirm}>
                  <input
                    id="confirm-password"
                    type="password"
                    value={password.confirm}
                    onChange={(e) => updatePassword('confirm', e.target.value)}
                    autoComplete="new-password"
                    className={inputClass(!!passwordErrors.confirm)}
                  />
                </Field>
              </div>

              <PasswordRules value={password.next} />

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-surface-2 pt-4 dark:border-gray-700/60">
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  修改密码需要验证当前密码。
                </span>
                <Button type="submit" disabled={passwordMutation.isPending}>
                  {passwordMutation.isPending ? '修改中...' : '修改密码'}
                </Button>
              </div>
            </form>
          </SettingsCard>
        </>
      )}
    </div>
  );
}

function PasswordRules({ value }: { value: string }) {
  const rules = [
    { met: value.length >= 8, label: '至少 8 位' },
    { met: /[a-z]/.test(value) && /[A-Z]/.test(value), label: '包含大小写字母' },
    { met: /\d/.test(value), label: '包含数字' },
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
