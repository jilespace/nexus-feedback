import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { useParams } from 'react-router-dom';
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

const defaultConfig: WidgetConfigData = {
  primaryColor: '#4F46E5',
  position: 'bottom-right',
  buttonLabel: '反馈',
  successTitle: '',
  successMessage: '',
  fields: { priority: true, contact: true, category: true },
};

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const FIELD_OPTIONS: Array<{
  key: keyof WidgetConfigData['fields'];
  label: string;
  description: string;
}> = [
  { key: 'category', label: '分类选择', description: '允许用户为反馈选择分类' },
  { key: 'priority', label: '优先级选择', description: '让用户提交时选择优先级' },
  { key: 'contact', label: '联系方式输入', description: '收集邮箱或电话，便于跟进' },
];

function mergeConfig(base: WidgetConfigData, data: Partial<WidgetConfigData>): WidgetConfigData {
  return {
    ...base,
    ...data,
    fields: { ...base.fields, ...(data.fields ?? {}) },
  };
}

function validateConfig(config: WidgetConfigData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!HEX_COLOR_RE.test(config.primaryColor)) {
    errors.primaryColor = '请输入 #RRGGBB 格式的颜色值';
  }
  if (!config.buttonLabel.trim()) errors.buttonLabel = '请输入按钮文字';
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
  const { show: toast } = useToast();
  const [config, setConfig] = useState<WidgetConfigData>(defaultConfig);
  const [saved, setSaved] = useState<WidgetConfigData>(defaultConfig);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['widget-config', projectId],
    queryFn: () => apiRequest<WidgetConfigData | null>(`/admin/projects/${projectId}/widget-config`),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (data === undefined) return;
    const next = data ? mergeConfig(defaultConfig, data) : defaultConfig;
    setConfig(next);
    setSaved(next);
    setErrors({});
  }, [data]);

  const mutation = useMutation({
    mutationFn: (cfg: WidgetConfigData) =>
      apiRequest<{ saved: boolean }>(`/admin/projects/${projectId}/widget-config`, {
        method: 'PUT',
        body: JSON.stringify(cfg),
      }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['widget-config', projectId] });
      setSaved(variables);
      toast('Widget 配置已保存', 'success');
    },
    onError: (err: Error) => toast(err.message || '保存失败', 'error'),
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
    const nextErrors = validateConfig(config);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    mutation.mutate(config);
  };

  const enabledFieldCount = FIELD_OPTIONS.filter((option) => config.fields[option.key]).length;

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="Widget 配置"
        description="配置内嵌反馈组件的主题、文案与可用字段，保存后宿主页面刷新即生效。"
        actions={
          <>
            {dirty && <Badge tone="amber">未保存</Badge>}
            <Button variant="secondary" onClick={handleReset} disabled={!dirty || mutation.isPending}>
              重置
            </Button>
            <Button
              type="submit"
              form="widget-config-form"
              disabled={!dirty || mutation.isPending || isLoading || isError}
            >
              {mutation.isPending ? '保存中...' : '保存配置'}
            </Button>
          </>
        }
      />

      {isError ? (
        <Card>
          <EmptyState
            icon={<WarningIcon />}
            title="加载 Widget 配置失败"
            description={error instanceof Error ? error.message : '请检查网络后重试。'}
            action={{ label: '重试', onClick: () => void refetch() }}
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
                title="外观"
                description="控制组件在主站上的品牌色、位置与入口文案。"
                action={<Badge tone="brand">实时预览</Badge>}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="主题色"
                    htmlFor="widget-primary-color"
                    error={errors.primaryColor}
                    hint="用于入口按钮、提交按钮与成功图标。"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="选择主题色"
                        value={HEX_COLOR_RE.test(config.primaryColor) ? config.primaryColor : defaultConfig.primaryColor}
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

                  <Field label="入口位置" htmlFor="widget-position">
                    <div className="relative">
                      <select
                        id="widget-position"
                        value={config.position}
                        onChange={(e) =>
                          updateConfig('position', e.target.value as WidgetConfigData['position'])
                        }
                        className={clsx(settingsInputClass(), 'appearance-none pr-9')}
                      >
                        <option value="bottom-right">右下角</option>
                        <option value="bottom-left">左下角</option>
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                        <ChevronDownIcon />
                      </span>
                    </div>
                  </Field>

                  <Field
                    label="按钮文字"
                    htmlFor="widget-button-label"
                    error={errors.buttonLabel}
                    hint="显示在悬浮入口按钮上，最多 20 个字符。"
                    className="sm:col-span-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        id="widget-button-label"
                        value={config.buttonLabel}
                        onChange={(e) => updateConfig('buttonLabel', e.target.value)}
                        maxLength={20}
                        placeholder="反馈"
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
                title="文案与字段"
                description="自定义提交成功后的提示语，并选择组件中展示的表单字段。"
                action={
                  <Badge tone="gray">
                    {enabledFieldCount}/{FIELD_OPTIONS.length} 字段
                  </Badge>
                }
              >
                <div className="space-y-4">
                  <Field
                    label="成功标题"
                    htmlFor="widget-success-title"
                    hint="留空时使用默认标题「提交成功」。"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        id="widget-success-title"
                        value={config.successTitle}
                        onChange={(e) => updateConfig('successTitle', e.target.value)}
                        maxLength={50}
                        placeholder="提交成功"
                        className={settingsInputClass()}
                      />
                      <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                        {config.successTitle.length}/50
                      </span>
                    </div>
                  </Field>

                  <Field
                    label="成功提示语"
                    htmlFor="widget-success-message"
                    hint="留空时使用默认提示语「感谢您的反馈，我们会尽快处理。」"
                  >
                    <div>
                      <textarea
                        id="widget-success-message"
                        value={config.successMessage}
                        onChange={(e) => updateConfig('successMessage', e.target.value)}
                        rows={3}
                        maxLength={200}
                        placeholder="感谢您的反馈，我们会尽快处理。"
                        className={clsx(settingsInputClass(), 'h-auto min-h-[76px] resize-none py-2 leading-relaxed')}
                      />
                      <div className="mt-1 flex items-center justify-end">
                        <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                          {config.successMessage.length}/200
                        </span>
                      </div>
                    </div>
                  </Field>

                  <Field label="表单字段">
                    <div className="divide-y divide-surface-2 overflow-hidden rounded-lg border border-surface-2 dark:divide-gray-700/60 dark:border-gray-700/60">
                      {FIELD_OPTIONS.map((option) => (
                        <div
                          key={option.key}
                          className="flex items-center justify-between gap-4 bg-surface-1/40 px-4 py-3 dark:bg-gray-900/20"
                        >
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200">
                              {option.label}
                            </p>
                            <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                              {option.description}
                            </p>
                          </div>
                          <Switch
                            checked={config.fields[option.key]}
                            onChange={(value) => updateFieldFlag(option.key, value)}
                            label={option.label}
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
  const [tab, setTab] = useState<PreviewTab>('form');
  const enabledFieldCount = FIELD_OPTIONS.filter((option) => config.fields[option.key]).length;

  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-surface-2 px-5 py-4 dark:border-gray-700/60">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">实时预览</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            与嵌入站点一致的组件外观
          </p>
        </div>
        <div
          role="tablist"
          aria-label="预览状态"
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
              {item === 'form' ? '表单态' : '成功态'}
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
                : defaultConfig.primaryColor,
            }}
          />
          <span className="font-mono uppercase">
            {HEX_COLOR_RE.test(config.primaryColor)
              ? config.primaryColor
              : defaultConfig.primaryColor}
          </span>
        </span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {config.position === 'bottom-right' ? '右下角' : '左下角'} · {enabledFieldCount}/
          {FIELD_OPTIONS.length} 字段
        </span>
      </div>
    </Card>
  );
}

function FormPreview({ config }: { config: WidgetConfigData }) {
  const positionClass = config.position === 'bottom-right' ? 'right-3' : 'left-3';
  const color = HEX_COLOR_RE.test(config.primaryColor)
    ? config.primaryColor
    : defaultConfig.primaryColor;

  return (
    <>
      <div className="absolute bottom-12 right-3 left-3 rounded-xl border border-surface-3 bg-surface-0 p-3 shadow-pop dark:border-gray-600 dark:bg-gray-900">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] font-semibold text-gray-900 dark:text-gray-100">提交反馈</p>
          <span className="flex h-4 w-4 items-center justify-center rounded text-[10px] text-gray-400">
            ×
          </span>
        </div>

        <div className="mt-2 h-12 rounded-lg border border-surface-3 bg-surface-1/60 px-2 py-1.5 text-[10px] leading-relaxed text-gray-400 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-500">
          请描述你遇到的问题…
        </div>

        {config.fields.category && (
          <div className="mt-2 flex flex-wrap gap-1">
            {['Bug 修复', '功能建议', '其他'].map((label) => (
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
            {['低', '中', '高'].map((label) => (
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
            联系方式（选填）
          </div>
        )}

        <div
          className="mt-2.5 flex h-7 items-center justify-center rounded-lg text-[11px] font-medium text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          提交反馈
        </div>
      </div>

      <div className={clsx('absolute bottom-3', positionClass)}>
        <div
          className="rounded-full px-3.5 py-1.5 text-[11px] font-medium text-white shadow-lg"
          style={{ backgroundColor: color }}
        >
          {config.buttonLabel.trim() || '反馈'}
        </div>
      </div>
    </>
  );
}

function SuccessPreview({ config }: { config: WidgetConfigData }) {
  const title = config.successTitle.trim() || '提交成功';
  const message = config.successMessage.trim() || '感谢您的反馈，我们会尽快处理。';
  const color = HEX_COLOR_RE.test(config.primaryColor)
    ? config.primaryColor
    : defaultConfig.primaryColor;

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
        关闭
      </button>
    </div>
  );
}

function EmbedSection() {
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
    <SectionCard
      title="嵌入代码"
      description="将代码粘贴到网站 HTML 的 </body> 前；保存配置后刷新宿主页面即可生效，Widget 会自动拉取最新配置。"
    >
      <CodeTabs
          tabs={[
            { id: 'script', label: '<script> 标签接入', code: scriptCode },
            { id: 'esm', label: 'React / ESM 接入', code: esmCode },
          ]}
        />

        <div className="mt-3 flex flex-wrap items-start gap-x-1.5 gap-y-1 rounded-lg border border-accent-200/70 bg-accent-50/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-accent-700 dark:border-accent-500/25 dark:bg-accent-500/10 dark:text-accent-300">
          <span aria-hidden="true">⚠</span>
          <span>
            API Key 请先在{' '}
            <a
              href="/applications"
              className="font-medium underline decoration-accent-400/60 underline-offset-2 hover:decoration-accent-500"
            >
              项目接入
            </a>{' '}
            页复制，再替换代码中的{' '}
            <code className="rounded bg-accent-100/70 px-1 font-mono text-[10px] dark:bg-accent-500/15">
              YOUR_PROJECT_API_KEY
            </code>
            。
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
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 剪贴板不可用时保持按钮原状 */
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
        {copied ? '已复制' : '复制'}
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
