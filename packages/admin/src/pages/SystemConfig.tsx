import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { apiRequest } from '@/api/client';
import { useToast } from '@/components/Toast';
import { PageHeader } from '@/components/PageHeader';
import { Badge, Button, Card, CardHeader, EmptyState, Skeleton } from '@/components/ui';

type StorageType = 'local' | 's3' | 'qiniu';

type ConfigForm = {
  emailApiKey: string;
  emailFrom: string;
  storageType: StorageType;
  storageBucket: string;
  storageRegion: string;
  storageEndpoint: string;
  storageAccessKey: string;
  storageSecretKey: string;
  storageDomain: string;
};

const STORAGE_OPTIONS: Array<{ value: StorageType; label: string; hint: string }> = [
  { value: 'local', label: '本地存储', hint: '附件保存在服务器本地磁盘，无需额外配置。' },
  { value: 's3', label: 'S3 兼容', hint: '兼容 AWS S3、MinIO、Cloudflare R2 等对象存储。' },
  { value: 'qiniu', label: '七牛云', hint: '使用七牛云对象存储，并通过 CDN 域名访问附件。' },
];

const EMPTY_FORM: ConfigForm = {
  emailApiKey: '',
  emailFrom: '',
  storageType: 'local',
  storageBucket: '',
  storageRegion: '',
  storageEndpoint: '',
  storageAccessKey: '',
  storageSecretKey: '',
  storageDomain: '',
};

function formFromConfig(data: Record<string, string>): ConfigForm {
  return {
    emailApiKey: data['email_api_key'] || '',
    emailFrom: data['email_from'] || '',
    storageType: (data['storage_type'] as StorageType) || 'local',
    storageBucket: data['storage_bucket'] || '',
    storageRegion: data['storage_region'] || '',
    storageEndpoint: data['storage_endpoint'] || '',
    storageAccessKey: data['storage_access_key'] || '',
    storageSecretKey: data['storage_secret_key'] || '',
    storageDomain: data['storage_domain'] || '',
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isMasked(value: string): boolean {
  return value.startsWith('****');
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

function SecretInput({
  id,
  value,
  onChange,
  placeholder,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={clsx(inputClass(invalid), 'pr-16 font-mono text-xs')}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-medium text-gray-400 transition-colors hover:bg-surface-2 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700/60 dark:hover:text-gray-300"
      >
        {visible ? '隐藏' : '显示'}
      </button>
    </div>
  );
}

function SettingsCard({
  title,
  description,
  action,
  footer,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="border-b border-surface-2 px-5 py-4 dark:border-gray-700/60">
        <CardHeader title={title} description={description} action={action} />
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

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="m4 6 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

export function SystemConfig() {
  const toast = useToast();
  const [form, setForm] = useState<ConfigForm>(EMPTY_FORM);
  const [saved, setSaved] = useState<ConfigForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['system-config'],
    queryFn: () => apiRequest<Record<string, string>>('/org/system-config'),
  });

  useEffect(() => {
    if (!data) return;
    const next = formFromConfig(data);
    setForm(next);
    setSaved(next);
    setErrors({});
  }, [data]);

  const emailDirty =
    form.emailApiKey !== saved.emailApiKey || form.emailFrom !== saved.emailFrom;
  const storageDirty =
    form.storageType !== saved.storageType ||
    form.storageBucket !== saved.storageBucket ||
    form.storageRegion !== saved.storageRegion ||
    form.storageEndpoint !== saved.storageEndpoint ||
    form.storageAccessKey !== saved.storageAccessKey ||
    form.storageSecretKey !== saved.storageSecretKey ||
    form.storageDomain !== saved.storageDomain;
  const dirty = emailDirty || storageDirty;

  const buildEmailPayload = () => ({
    email_api_key: form.emailApiKey,
    email_from: form.emailFrom,
  });

  const buildStoragePayload = () => {
    const configs: Record<string, string> = { storage_type: form.storageType };
    if (form.storageType === 's3') {
      Object.assign(configs, {
        storage_bucket: form.storageBucket,
        storage_region: form.storageRegion,
        storage_endpoint: form.storageEndpoint,
        storage_access_key: form.storageAccessKey,
        storage_secret_key: form.storageSecretKey,
      });
    } else if (form.storageType === 'qiniu') {
      Object.assign(configs, {
        storage_bucket: form.storageBucket,
        storage_access_key: form.storageAccessKey,
        storage_secret_key: form.storageSecretKey,
        storage_domain: form.storageDomain,
      });
    }
    return configs;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (emailDirty) {
        await apiRequest('/org/system-config', {
          method: 'PUT',
          body: JSON.stringify({ configs: buildEmailPayload() }),
        });
      }
      if (storageDirty) {
        await apiRequest('/org/system-config', {
          method: 'PUT',
          body: JSON.stringify({ configs: buildStoragePayload() }),
        });
      }
    },
    onSuccess: async () => {
      // Refetch to resync the form (and masked secrets) after saving.
      const result = await refetch();
      if (result.data) {
        const next = formFromConfig(result.data);
        setForm(next);
        setSaved(next);
      }
      toast.show('配置已保存');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '保存失败', 'error'),
  });

  const updateField = <K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const field = key as string;
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleReset = () => {
    setForm(saved);
    setErrors({});
  };

  const handleSave = () => {
    const nextErrors: Record<string, string> = {};
    if (emailDirty && form.emailFrom.trim() && !EMAIL_RE.test(form.emailFrom.trim())) {
      nextErrors.emailFrom = '请输入有效的发件人邮箱地址';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    saveMutation.mutate();
  };

  const headerActions = (
    <>
      {dirty && <Badge tone="amber">未保存</Badge>}
      <Button variant="secondary" onClick={handleReset} disabled={!dirty || saveMutation.isPending}>
        重置
      </Button>
      <Button onClick={handleSave} disabled={!dirty || saveMutation.isPending}>
        {saveMutation.isPending ? '保存中...' : '保存更改'}
      </Button>
    </>
  );

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="系统配置"
        description="配置组织级邮件发送与附件存储服务，仅组织所有者可修改。"
        actions={isLoading || isError ? undefined : headerActions}
      />

      {isError ? (
        <Card>
          <EmptyState
            icon={<WarningIcon />}
            title="加载系统配置失败"
            description={error instanceof Error ? error.message : '请检查网络后重试。'}
            action={{ label: '重试', onClick: () => void refetch() }}
          />
        </Card>
      ) : isLoading ? (
        <div className="space-y-5">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <>
          <SettingsCard
            title="邮件服务"
            description="用于发送成员邀请、状态变更通知与周报邮件。未配置时，邀请会改为生成链接手动分享。"
            action={
              <Badge tone={saved.emailApiKey ? 'green' : 'gray'}>
                {saved.emailApiKey ? '已配置' : '未配置'}
              </Badge>
            }
            footer={<SaveStatus dirty={emailDirty} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="API Key"
                htmlFor="email-api-key"
                hint={
                  isMasked(saved.emailApiKey)
                    ? `已保存的密钥仅显示掩码（${saved.emailApiKey}），保持不变即可保留原值；填写新值将覆盖。`
                    : '调用邮件服务商的 API Key，仅保存在服务端。'
                }
              >
                <SecretInput
                  id="email-api-key"
                  value={form.emailApiKey}
                  onChange={(value) => updateField('emailApiKey', value)}
                  placeholder="输入 Resend API Key"
                />
              </Field>
              <Field label="发件人邮箱" htmlFor="email-from" error={errors.emailFrom}>
                <input
                  id="email-from"
                  type="email"
                  value={form.emailFrom}
                  onChange={(e) => updateField('emailFrom', e.target.value)}
                  placeholder="notifications@example.com"
                  autoComplete="off"
                  className={inputClass(!!errors.emailFrom)}
                />
              </Field>
            </div>
          </SettingsCard>

          <SettingsCard
            title="文件存储"
            description="决定反馈附件（截图、日志）的上传位置与公开访问方式。"
            action={
              <Badge tone="gray">
                {STORAGE_OPTIONS.find((option) => option.value === form.storageType)?.label ??
                  '本地存储'}
              </Badge>
            }
            footer={<SaveStatus dirty={storageDirty} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="存储类型"
                htmlFor="storage-type"
                hint={
                  form.storageType === 'local'
                    ? undefined
                    : STORAGE_OPTIONS.find((option) => option.value === form.storageType)?.hint
                }
              >
                <div className="relative">
                  <select
                    id="storage-type"
                    value={form.storageType}
                    onChange={(e) => updateField('storageType', e.target.value as StorageType)}
                    className={clsx(inputClass(), 'appearance-none pr-9')}
                  >
                    {STORAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                    <ChevronDownIcon />
                  </span>
                </div>
              </Field>
            </div>

            {form.storageType === 'local' ? (
              <div className="mt-4 rounded-lg border border-dashed border-surface-3 bg-surface-1/60 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/30">
                <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300">
                  附件保存在服务器本地
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
                  适合自托管部署。切换其它类型后可填写 Bucket 与访问密钥。
                </p>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Bucket" htmlFor="storage-bucket">
                  <input
                    id="storage-bucket"
                    value={form.storageBucket}
                    onChange={(e) => updateField('storageBucket', e.target.value)}
                    placeholder="nexus-attachments"
                    spellCheck={false}
                    className={inputClass()}
                  />
                </Field>

                {form.storageType === 's3' && (
                  <>
                    <Field label="Region" htmlFor="storage-region">
                      <input
                        id="storage-region"
                        value={form.storageRegion}
                        onChange={(e) => updateField('storageRegion', e.target.value)}
                        placeholder="ap-northeast-1"
                        spellCheck={false}
                        className={inputClass()}
                      />
                    </Field>
                    <Field
                      label="Endpoint"
                      htmlFor="storage-endpoint"
                      hint="使用 AWS 官方服务时可留空。"
                      className="sm:col-span-2"
                    >
                      <input
                        id="storage-endpoint"
                        value={form.storageEndpoint}
                        onChange={(e) => updateField('storageEndpoint', e.target.value)}
                        placeholder="https://s3.example.com"
                        spellCheck={false}
                        className={inputClass()}
                      />
                    </Field>
                  </>
                )}

                {form.storageType === 'qiniu' && (
                  <Field
                    label="CDN 域名"
                    htmlFor="storage-domain"
                    hint="附件通过该域名公开访问，例如 cdn.example.com。"
                  >
                    <input
                      id="storage-domain"
                      value={form.storageDomain}
                      onChange={(e) => updateField('storageDomain', e.target.value)}
                      placeholder="cdn.example.com"
                      spellCheck={false}
                      className={inputClass()}
                    />
                  </Field>
                )}

                <Field
                  label="Access Key"
                  htmlFor="storage-access-key"
                  hint={
                    isMasked(saved.storageAccessKey)
                      ? `已保存的密钥仅显示掩码（${saved.storageAccessKey}），保持不变即可保留。`
                      : '对象存储访问密钥。'
                  }
                >
                  <SecretInput
                    id="storage-access-key"
                    value={form.storageAccessKey}
                    onChange={(value) => updateField('storageAccessKey', value)}
                  />
                </Field>
                <Field
                  label="Secret Key"
                  htmlFor="storage-secret-key"
                  hint={
                    isMasked(saved.storageSecretKey)
                      ? `已保存的密钥仅显示掩码（${saved.storageSecretKey}），保持不变即可保留。`
                      : '对象存储密钥，仅保存在服务端。'
                  }
                >
                  <SecretInput
                    id="storage-secret-key"
                    value={form.storageSecretKey}
                    onChange={(value) => updateField('storageSecretKey', value)}
                  />
                </Field>
              </div>
            )}
          </SettingsCard>
        </>
      )}
    </div>
  );
}
