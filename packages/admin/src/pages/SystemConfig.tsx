import { useEffect, useState } from 'react';
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

const STORAGE_TYPES: StorageType[] = ['local', 's3', 'qiniu'];

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

function SecretInput({
  id,
  value,
  onChange,
  placeholder,
  invalid,
  label,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  label: string;
}) {
  const { t } = useTranslation('settings');
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
        className={clsx(settingsInputClass(invalid), 'pr-16 font-mono text-xs')}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={
          visible ? t('common.hideSecret', { name: label }) : t('common.showSecret', { name: label })
        }
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-medium text-gray-400 transition-colors hover:bg-surface-2 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-gray-500 dark:hover:bg-gray-700/60 dark:hover:text-gray-300"
      >
        {visible ? t('common.hide') : t('common.show')}
      </button>
    </div>
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
  const { t } = useTranslation('settings');
  const toast = useToast();
  const [form, setForm] = useState<ConfigForm>(EMPTY_FORM);
  const [saved, setSaved] = useState<ConfigForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const storageOptions = STORAGE_TYPES.map((value) => ({
    value,
    label: t(`system.storage.${value}.label`),
    hint: t(`system.storage.${value}.hint`),
  }));

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
      toast.show(t('system.savedToast'));
    },
    onError: (err) =>
      toast.show(err instanceof Error ? err.message : t('common.saveFailed'), 'error'),
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
      nextErrors.emailFrom = t('system.email.from.invalid');
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    saveMutation.mutate();
  };

  const headerActions = (
    <>
      {dirty && <Badge tone="amber">{t('common.unsaved')}</Badge>}
      <Button variant="secondary" onClick={handleReset} disabled={!dirty || saveMutation.isPending}>
        {t('common.reset')}
      </Button>
      <Button onClick={handleSave} disabled={!dirty || saveMutation.isPending}>
        {saveMutation.isPending ? t('common.saving') : t('system.saveAction')}
      </Button>
    </>
  );

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title={t('system.title')}
        description={t('system.description')}
        actions={isLoading || isError ? undefined : headerActions}
      />

      {isError ? (
        <Card>
          <EmptyState
            icon={<WarningIcon />}
            title={t('system.loadErrorTitle')}
            description={error instanceof Error ? error.message : t('common.checkNetwork')}
            action={{ label: t('common.retry'), onClick: () => void refetch() }}
          />
        </Card>
      ) : isLoading ? (
        <div className="space-y-5">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <>
          <SectionCard
            title={t('system.email.title')}
            description={t('system.email.description')}
            action={
              <Badge tone={saved.emailApiKey ? 'green' : 'gray'}>
                {saved.emailApiKey
                  ? t('system.email.configured')
                  : t('system.email.unconfigured')}
              </Badge>
            }
            footer={<SaveStatus dirty={emailDirty} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t('system.email.apiKey.label')}
                htmlFor="email-api-key"
                hint={
                  isMasked(saved.emailApiKey)
                    ? t('system.email.apiKey.hintMasked', { mask: saved.emailApiKey })
                    : t('system.email.apiKey.hintUnset')
                }
              >
                <SecretInput
                  id="email-api-key"
                  value={form.emailApiKey}
                  onChange={(value) => updateField('emailApiKey', value)}
                  label={t('system.email.apiKey.label')}
                  placeholder={t('system.email.apiKey.placeholder')}
                />
              </Field>
              <Field
                label={t('system.email.from.label')}
                htmlFor="email-from"
                error={errors.emailFrom}
              >
                <input
                  id="email-from"
                  type="email"
                  value={form.emailFrom}
                  onChange={(e) => updateField('emailFrom', e.target.value)}
                  placeholder="notifications@example.com"
                  autoComplete="off"
                  className={settingsInputClass(!!errors.emailFrom)}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title={t('system.storage.title')}
            description={t('system.storage.description')}
            action={
              <Badge tone="gray">
                {storageOptions.find((option) => option.value === form.storageType)?.label ??
                  t('system.storage.local.label')}
              </Badge>
            }
            footer={<SaveStatus dirty={storageDirty} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t('system.storage.typeLabel')}
                htmlFor="storage-type"
                hint={
                  form.storageType === 'local'
                    ? undefined
                    : storageOptions.find((option) => option.value === form.storageType)?.hint
                }
              >
                <div className="relative">
                  <select
                    id="storage-type"
                    value={form.storageType}
                    onChange={(e) => updateField('storageType', e.target.value as StorageType)}
                    className={clsx(settingsInputClass(), 'appearance-none pr-9')}
                  >
                    {storageOptions.map((option) => (
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
                  {t('system.storage.localPanel.title')}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
                  {t('system.storage.localPanel.body')}
                </p>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label={t('system.storage.bucket.label')} htmlFor="storage-bucket">
                  <input
                    id="storage-bucket"
                    value={form.storageBucket}
                    onChange={(e) => updateField('storageBucket', e.target.value)}
                    placeholder={t('system.storage.bucket.placeholder')}
                    spellCheck={false}
                    className={settingsInputClass()}
                  />
                </Field>

                {form.storageType === 's3' && (
                  <>
                    <Field label={t('system.storage.region.label')} htmlFor="storage-region">
                      <input
                        id="storage-region"
                        value={form.storageRegion}
                        onChange={(e) => updateField('storageRegion', e.target.value)}
                        placeholder={t('system.storage.region.placeholder')}
                        spellCheck={false}
                        className={settingsInputClass()}
                      />
                    </Field>
                    <Field
                      label={t('system.storage.endpoint.label')}
                      htmlFor="storage-endpoint"
                      hint={t('system.storage.endpoint.hint')}
                      className="sm:col-span-2"
                    >
                      <input
                        id="storage-endpoint"
                        value={form.storageEndpoint}
                        onChange={(e) => updateField('storageEndpoint', e.target.value)}
                        placeholder={t('system.storage.endpoint.placeholder')}
                        spellCheck={false}
                        className={settingsInputClass()}
                      />
                    </Field>
                  </>
                )}

                {form.storageType === 'qiniu' && (
                  <Field
                    label={t('system.storage.cdnDomain.label')}
                    htmlFor="storage-domain"
                    hint={t('system.storage.cdnDomain.hint')}
                  >
                    <input
                      id="storage-domain"
                      value={form.storageDomain}
                      onChange={(e) => updateField('storageDomain', e.target.value)}
                      placeholder={t('system.storage.cdnDomain.placeholder')}
                      spellCheck={false}
                      className={settingsInputClass()}
                    />
                  </Field>
                )}

                <Field
                  label={t('system.storage.accessKey.label')}
                  htmlFor="storage-access-key"
                  hint={
                    isMasked(saved.storageAccessKey)
                      ? t('system.storage.accessKey.hintMasked', { mask: saved.storageAccessKey })
                      : t('system.storage.accessKey.hintUnset')
                  }
                >
                  <SecretInput
                    id="storage-access-key"
                    value={form.storageAccessKey}
                    onChange={(value) => updateField('storageAccessKey', value)}
                    label={t('system.storage.accessKey.label')}
                  />
                </Field>
                <Field
                  label={t('system.storage.secretKey.label')}
                  htmlFor="storage-secret-key"
                  hint={
                    isMasked(saved.storageSecretKey)
                      ? t('system.storage.secretKey.hintMasked', { mask: saved.storageSecretKey })
                      : t('system.storage.secretKey.hintUnset')
                  }
                >
                  <SecretInput
                    id="storage-secret-key"
                    value={form.storageSecretKey}
                    onChange={(value) => updateField('storageSecretKey', value)}
                    label={t('system.storage.secretKey.label')}
                  />
                </Field>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
