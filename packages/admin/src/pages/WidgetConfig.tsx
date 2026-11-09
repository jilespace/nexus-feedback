import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Switch,
  settingsInputClass,
} from '@/components/ui';
import type { WidgetConfig as WidgetConfigData } from '@/types';

const DEFAULT_PRIMARY_COLOR = '#4F46E5';
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const FIELD_OPTIONS: Array<{
  key: keyof WidgetConfigData['fields'];
  labelKey: string;
  descriptionKey: string;
}> = [
  { key: 'category', labelKey: 'widget.content.category.label', descriptionKey: 'widget.content.category.description' },
  { key: 'priority', labelKey: 'widget.content.priority.label', descriptionKey: 'widget.content.priority.description' },
  { key: 'contact', labelKey: 'widget.content.contact.label', descriptionKey: 'widget.content.contact.description' },
];

function createDefaultConfig(t: (key: string) => string): WidgetConfigData {
  return {
    primaryColor: DEFAULT_PRIMARY_COLOR,
    position: 'bottom-right',
    buttonLabel: t('widget.defaults.buttonLabel'),
    successTitle: '',
    successMessage: '',
    fields: { priority: true, contact: true, category: true },
  };
}

function mergeConfig(base: WidgetConfigData, data: Partial<WidgetConfigData>): WidgetConfigData {
  return {
    ...base,
    ...data,
    fields: { ...base.fields, ...(data.fields ?? {}) },
  };
}

function validateConfig(config: WidgetConfigData, t: (key: string) => string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!HEX_COLOR_RE.test(config.primaryColor)) {
    errors.primaryColor = t('common.colorInvalid');
  }
  if (!config.buttonLabel.trim()) errors.buttonLabel = t('widget.appearance.buttonLabel.required');
  return errors;
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

export function WidgetConfig() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const { t } = useTranslation('settings');
  const { show: toast } = useToast();
  const [defaults] = useState<WidgetConfigData>(() => createDefaultConfig(t));
  const [config, setConfig] = useState<WidgetConfigData>(defaults);
  const [saved, setSaved] = useState<WidgetConfigData>(defaults);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['widget-config', projectId],
    queryFn: () => apiRequest<WidgetConfigData | null>(`/admin/projects/${projectId}/widget-config`),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (data === undefined) return;
    const next = data ? mergeConfig(defaults, data) : defaults;
    setConfig(next);
    setSaved(next);
    setErrors({});
  }, [data, defaults]);

  const mutation = useMutation({
    mutationFn: (cfg: WidgetConfigData) =>
      apiRequest<{ saved: boolean }>(`/admin/projects/${projectId}/widget-config`, {
        method: 'PUT',
        body: JSON.stringify(cfg),
      }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['widget-config', projectId] });
      setSaved(variables);
      toast(t('widget.savedToast'), 'success');
    },
    onError: (err: Error) => toast(err.message || t('common.saveFailed'), 'error'),
  });

  const dirty = JSON.stringify(config) !== JSON.stringify(saved);

  const updateConfig = <K extends keyof WidgetConfigData>(key: K, value: WidgetConfigData[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const updateFieldFlag = (key: keyof WidgetConfigData['fields'], value: boolean) => {
    setConfig((prev) => ({ ...prev, fields: { ...prev.fields, [key]: value } }));
  };

  const handleReset = () => {
    setConfig(saved);
    setErrors({});
  };

  const handleSave = (event?: FormEvent) => {
    event?.preventDefault();
    if (!projectId) return;
    const nextErrors = validateConfig(config, t);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    mutation.mutate(config);
  };

  const enabledFieldCount = FIELD_OPTIONS.filter((option) => config.fields[option.key]).length;

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title={t('widget.title')}
        description={t('widget.description')}
        actions={
          <>
            {dirty && <Badge tone="amber">{t('common.unsaved')}</Badge>}
            <Button variant="secondary" onClick={handleReset} disabled={!dirty || mutation.isPending}>
              {t('common.reset')}
            </Button>
            <Button
              type="submit"
              form="widget-config-form"
              disabled={!dirty || mutation.isPending || isLoading || isError}
            >
              {mutation.isPending ? t('common.saving') : t('widget.saveAction')}
            </Button>
          </>
        }
      />

      {isError ? (
        <Card>
          <EmptyState
            icon={<WarningIcon />}
            title={t('widget.loadErrorTitle')}
            description={error instanceof Error ? error.message : t('common.checkNetwork')}
            action={{ label: t('common.retry'), onClick: () => void refetch() }}
          />
        </Card>
      ) : isLoading ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
          <Skeleton className="h-[420px] rounded-xl" />
        </div>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <form id="widget-config-form" onSubmit={handleSave} noValidate className="space-y-5">
              <SectionCard
                title={t('widget.appearance.title')}
                description={t('widget.appearance.description')}
                action={<Badge tone="brand">{t('widget.appearance.livePreview')}</Badge>}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={t('widget.appearance.color.label')}
                    htmlFor="widget-primary-color"
                    error={errors.primaryColor}
                    hint={t('widget.appearance.color.hint')}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label={t('widget.appearance.color.aria')}
                        value={HEX_COLOR_RE.test(config.primaryColor) ? config.primaryColor : DEFAULT_PRIMARY_COLOR}
                        onChange={(e) => updateConfig('primaryColor', e.target.value)}
                        className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-surface-3 bg-surface-0 p-0.5 dark:border-gray-700 dark:bg-gray-800"
                      />
                      <input
                        id="widget-primary-color"
                        value={config.primaryColor}
                        onChange={(e) => updateConfig('primaryColor', e.target.value)}
                        spellCheck={false}
                        className={clsx(
                          settingsInputClass(!!errors.primaryColor),
                          'font-mono text-xs uppercase',
                        )}
                      />
                    </div>
                  </Field>

                  <Field label={t('widget.appearance.position.label')} htmlFor="widget-position">
                    <div className="relative">
                      <select
                        id="widget-position"
                        value={config.position}
                        onChange={(e) =>
                          updateConfig('position', e.target.value as WidgetConfigData['position'])
                        }
                        className={clsx(settingsInputClass(), 'appearance-none pr-9')}
                      >
                        <option value="bottom-right">
                          {t('widget.appearance.position.bottomRight')}
                        </option>
                        <option value="bottom-left">
                          {t('widget.appearance.position.bottomLeft')}
                        </option>
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                        <ChevronDownIcon />
                      </span>
                    </div>
                  </Field>

                  <Field
                    label={t('widget.appearance.buttonLabel.label')}
                    htmlFor="widget-button-label"
                    error={errors.buttonLabel}
                    hint={t('widget.appearance.buttonLabel.hint')}
                    className="sm:col-span-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        id="widget-button-label"
                        value={config.buttonLabel}
                        onChange={(e) => updateConfig('buttonLabel', e.target.value)}
                        maxLength={20}
                        placeholder={t('widget.defaults.buttonLabel')}
                        className={settingsInputClass(!!errors.buttonLabel)}
                      />
                      <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                        {config.buttonLabel.length}/20
                      </span>
                    </div>
                  </Field>
                </div>
              </SectionCard>

              <SectionCard
                title={t('widget.content.title')}
                description={t('widget.content.description')}
                action={
                  <Badge tone="gray">
                    {t('widget.content.fieldsBadge', {
                      enabled: enabledFieldCount,
                      total: FIELD_OPTIONS.length,
                    })}
                  </Badge>
                }
              >
                <div className="space-y-4">
                  <Field
                    label={t('widget.content.successTitle.label')}
                    htmlFor="widget-success-title"
                    hint={t('widget.content.successTitle.hint')}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        id="widget-success-title"
                        value={config.successTitle}
                        onChange={(e) => updateConfig('successTitle', e.target.value)}
                        maxLength={50}
                        placeholder={t('widget.content.successTitle.placeholder')}
                        className={settingsInputClass()}
                      />
                      <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                        {config.successTitle.length}/50
                      </span>
                    </div>
                  </Field>

                  <Field
                    label={t('widget.content.successMessage.label')}
                    htmlFor="widget-success-message"
                    hint={t('widget.content.successMessage.hint')}
                  >
                    <div>
                      <textarea
                        id="widget-success-message"
                        value={config.successMessage}
                        onChange={(e) => updateConfig('successMessage', e.target.value)}
                        rows={3}
                        maxLength={200}
                        placeholder={t('widget.content.successMessage.placeholder')}
                        className={clsx(settingsInputClass(), 'h-auto min-h-[76px] resize-none py-2 leading-relaxed')}
                      />
                      <div className="mt-1 flex items-center justify-end">
                        <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                          {config.successMessage.length}/200
                        </span>
                      </div>
                    </div>
                  </Field>

                  <Field label={t('widget.content.fieldsLabel')}>
                    <div className="divide-y divide-surface-2 overflow-hidden rounded-lg border border-surface-2 dark:divide-gray-700/60 dark:border-gray-700/60">
                      {FIELD_OPTIONS.map((option) => (
                        <div
                          key={option.key}
                          className="flex items-center justify-between gap-4 bg-surface-1/40 px-4 py-3 dark:bg-gray-900/20"
                        >
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200">
                              {t(option.labelKey)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                              {t(option.descriptionKey)}
                            </p>
                          </div>
                          <Switch
                            checked={config.fields[option.key]}
                            onChange={(value) => updateFieldFlag(option.key, value)}
                            label={t(option.labelKey)}
                          />
                        </div>
                      ))}
                    </div>
                  </Field>
                </div>
              </SectionCard>
            </form>

            <div className="xl:sticky xl:top-6 xl:self-start">
              <PreviewSection config={config} />
            </div>
          </div>

          <EmbedSection />
        </>
      )}
    </div>
  );
}

type PreviewTab = 'form' | 'success';

function PreviewSection({ config }: { config: WidgetConfigData }) {
  const { t } = useTranslation('settings');
  const [tab, setTab] = useState<PreviewTab>('form');
  const enabledFieldCount = FIELD_OPTIONS.filter((option) => config.fields[option.key]).length;
  const positionLabel =
    config.position === 'bottom-right'
      ? t('widget.appearance.position.bottomRight')
      : t('widget.appearance.position.bottomLeft');

  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-surface-2 px-5 py-4 dark:border-gray-700/60">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t('widget.preview.title')}
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('widget.preview.description')}
          </p>
        </div>
        <div
          role="tablist"
          aria-label={t('widget.preview.tabsAria')}
          className="flex shrink-0 gap-1 rounded-lg bg-surface-2 p-1 dark:bg-gray-900/40"
        >
          {(['form', 'success'] as PreviewTab[]).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              onClick={() => setTab(item)}
              className={clsx(
                'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                tab === item
                  ? 'bg-surface-0 text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              )}
            >
              {item === 'form' ? t('widget.preview.formTab') : t('widget.preview.successTab')}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-dots bg-surface-1/60 p-5 dark:bg-gray-900/30">
        <div
          aria-hidden="true"
          className="relative mx-auto h-[340px] w-full max-w-[300px] overflow-hidden rounded-xl border border-surface-3 bg-surface-0 shadow-card dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="h-8 border-b border-surface-2 bg-surface-1/70 px-3 dark:border-gray-700/60 dark:bg-gray-900/40">
            <div className="flex h-full items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-surface-3 dark:bg-gray-600" />
              <span className="h-1.5 w-1.5 rounded-full bg-surface-3 dark:bg-gray-600" />
              <span className="ml-2 h-2 w-24 rounded-full bg-surface-2 dark:bg-gray-700" />
            </div>
          </div>

          <div className="p-4">
            <div className="h-2.5 w-24 rounded bg-surface-2 dark:bg-gray-700" />
            <div className="mt-2 h-2 w-40 rounded bg-surface-2/70 dark:bg-gray-700/60" />
            <div className="mt-1.5 h-2 w-32 rounded bg-surface-2/70 dark:bg-gray-700/60" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="h-14 rounded-lg bg-surface-1 dark:bg-gray-900/40" />
              <div className="h-14 rounded-lg bg-surface-1 dark:bg-gray-900/40" />
            </div>
          </div>

          {tab === 'form' ? <FormPreview config={config} /> : <SuccessPreview config={config} />}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-2 px-5 py-3 dark:border-gray-700/60">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
          <span
            className="h-2.5 w-2.5 rounded-[3px] ring-1 ring-black/10 dark:ring-white/10"
            style={{
              backgroundColor: HEX_COLOR_RE.test(config.primaryColor)
                ? config.primaryColor
                : DEFAULT_PRIMARY_COLOR,
            }}
          />
          <span className="font-mono uppercase">
            {HEX_COLOR_RE.test(config.primaryColor)
              ? config.primaryColor
              : DEFAULT_PRIMARY_COLOR}
          </span>
        </span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {t('widget.preview.summary', {
            position: positionLabel,
            enabled: enabledFieldCount,
            total: FIELD_OPTIONS.length,
          })}
        </span>
      </div>
    </Card>
  );
}

function FormPreview({ config }: { config: WidgetConfigData }) {
  const { t } = useTranslation('settings');
  const positionClass = config.position === 'bottom-right' ? 'right-3' : 'left-3';
  const color = HEX_COLOR_RE.test(config.primaryColor)
    ? config.primaryColor
    : DEFAULT_PRIMARY_COLOR;

  return (
    <>
      <div className="absolute bottom-12 right-3 left-3 rounded-xl border border-surface-3 bg-surface-0 p-3 shadow-pop dark:border-gray-600 dark:bg-gray-900">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] font-semibold text-gray-900 dark:text-gray-100">
            {t('widget.preview.panelTitle')}
          </p>
          <span className="flex h-4 w-4 items-center justify-center rounded text-[10px] text-gray-400">
            ×
          </span>
        </div>

        <div className="mt-2 h-12 rounded-lg border border-surface-3 bg-surface-1/60 px-2 py-1.5 text-[10px] leading-relaxed text-gray-400 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-500">
          {t('widget.preview.panelPlaceholder')}
        </div>

        {config.fields.category && (
          <div className="mt-2 flex flex-wrap gap-1">
            {[
              t('widget.preview.categoryBug'),
              t('widget.preview.categoryFeature'),
              t('widget.preview.categoryOther'),
            ].map((label) => (
              <span
                key={label}
                className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-gray-500 dark:bg-gray-700/60 dark:text-gray-400"
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {config.fields.priority && (
          <div className="mt-2 flex gap-1">
            {[
              t('widget.preview.priorityLow'),
              t('widget.preview.priorityMedium'),
              t('widget.preview.priorityHigh'),
            ].map((label) => (
              <span
                key={label}
                className="flex-1 rounded-full border border-surface-3 py-0.5 text-center text-[10px] text-gray-500 dark:border-gray-700 dark:text-gray-400"
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {config.fields.contact && (
          <div className="mt-2 h-7 rounded-lg border border-dashed border-surface-3 px-2 text-[10px] leading-7 text-gray-400 dark:border-gray-700 dark:text-gray-500">
            {t('widget.preview.contactPlaceholder')}
          </div>
        )}

        <div
          className="mt-2.5 flex h-7 items-center justify-center rounded-lg text-[11px] font-medium text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          {t('widget.preview.submit')}
        </div>
      </div>

      <div className={clsx('absolute bottom-3', positionClass)}>
        <div
          className="rounded-full px-3.5 py-1.5 text-[11px] font-medium text-white shadow-lg"
          style={{ backgroundColor: color }}
        >
          {config.buttonLabel.trim() || t('widget.defaults.buttonLabel')}
        </div>
      </div>
    </>
  );
}

function SuccessPreview({ config }: { config: WidgetConfigData }) {
  const { t } = useTranslation('settings');
  const title = config.successTitle.trim() || t('widget.defaults.successTitle');
  const message = config.successMessage.trim() || t('widget.defaults.successMessage');
  const color = HEX_COLOR_RE.test(config.primaryColor)
    ? config.primaryColor
    : DEFAULT_PRIMARY_COLOR;

  return (
    <div className="absolute inset-x-4 bottom-4 rounded-xl border border-surface-3 bg-surface-0 p-4 text-center shadow-pop dark:border-gray-600 dark:bg-gray-900">
      <div
        className="mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-semibold text-white shadow-sm"
        style={{ backgroundColor: color }}
      >
        ✓
      </div>
      <p className="mt-2 text-[12px] font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      <p className="mt-1 max-h-16 overflow-hidden text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
        {message}
      </p>
      <button
        type="button"
        className="mt-3 h-7 w-full rounded-lg border border-surface-3 bg-surface-0 text-[10px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        {t('widget.preview.close')}
      </button>
    </div>
  );
}

function EmbedSection() {
  const { t } = useTranslation('settings');
  const apiUrl = `${window.location.origin}/api/v1`;
  const scriptCode = `<!-- Nexus Feedback Widget -->
<script src="${window.location.origin}/widget/nexus-feedback-widget.iife.js"></script>
<script>
  NexusFeedbackWidget.mount(document.body, {
    apiKey: 'YOUR_PROJECT_API_KEY',
    apiUrl: '${apiUrl}'
  });
</script>`;
  const esmCode = `import { FeedbackWidget } from '@nexus-feedback/widget';

<FeedbackWidget apiKey="YOUR_PROJECT_API_KEY" apiUrl="${apiUrl}" />`;

  return (
    <SectionCard title={t('widget.embed.title')} description={t('widget.embed.description')}>
      <CodeTabs
        tabs={[
          { id: 'script', label: t('widget.embed.scriptTab'), code: scriptCode },
          { id: 'esm', label: t('widget.embed.esmTab'), code: esmCode },
        ]}
      />

      <div className="mt-3 flex flex-wrap items-start gap-x-1.5 gap-y-1 rounded-lg border border-accent-200/70 bg-accent-50/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-accent-700 dark:border-accent-500/25 dark:bg-accent-500/10 dark:text-accent-300">
        <span aria-hidden="true">⚠</span>
        <span>
          {t('widget.embed.apiKeyHintBefore')}{' '}
          <a
            href="/applications"
            className="font-medium underline decoration-accent-400/60 underline-offset-2 hover:decoration-accent-500"
          >
            {t('widget.embed.apiKeyHintApplications')}
          </a>{' '}
          {t('widget.embed.apiKeyHintBetween')}{' '}
          <code className="rounded bg-accent-100/70 px-1 font-mono text-[10px] dark:bg-accent-500/15">
            YOUR_PROJECT_API_KEY
          </code>{' '}
          {t('widget.embed.apiKeyHintAfter')}
        </span>
      </div>
    </SectionCard>
  );
}

function CodeTabs({ tabs }: { tabs: { id: string; label: string; code: string }[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? '');
  const active = tabs.find((tab) => tab.id === activeId);

  return (
    <div>
      <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-surface-2 p-1 dark:bg-gray-900/40">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveId(tab.id)}
            className={clsx(
              'rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors',
              tab.id === activeId
                ? 'bg-surface-0 text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active && <CodeBlock key={active.id} code={active.code} />}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const { t } = useTranslation('settings');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Keep the button as-is when the clipboard is unavailable. */
    }
  };

  return (
    <div className="relative mt-3">
      <pre className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-950 p-3.5 text-[12px] leading-relaxed text-gray-200">
        <code>{highlightApiKey(code)}</code>
      </pre>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className={clsx(
          'absolute right-2 top-2 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
          copied
            ? 'bg-emerald-600 text-white'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white',
        )}
      >
        {copied ? t('common.copied') : t('common.copy')}
      </button>
    </div>
  );
}

function highlightApiKey(code: string): (string | ReactElement)[] {
  return code.split('YOUR_PROJECT_API_KEY').flatMap((part, index, arr) => {
    if (index === arr.length - 1) return [part];
    return [
      part,
      <span key={index} className="rounded bg-accent-400/20 px-0.5 text-accent-300">
        YOUR_PROJECT_API_KEY
      </span>,
    ];
  });
}
