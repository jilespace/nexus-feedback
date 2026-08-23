import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { apiRequest } from '@/api/client';
import { useToast } from '@/components/Toast';
import type { WidgetConfig as WidgetConfigData } from '@/types';

const defaultConfig: WidgetConfigData = {
  primaryColor: '#4F46E5',
  position: 'bottom-right',
  buttonLabel: '反馈',
  successTitle: '',
  successMessage: '',
  fields: { priority: true, contact: true, category: true },
};

type PreviewTab = 'form' | 'success';

export function WidgetConfig() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const { show: toast } = useToast();
  const [config, setConfig] = useState<WidgetConfigData>(defaultConfig);

  const { data } = useQuery({
    queryKey: ['widget-config', projectId],
    queryFn: () =>
      apiRequest<WidgetConfigData | null>(
        `/admin/projects/${projectId}/widget-config`,
      ),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (data) setConfig(mergeConfig(defaultConfig, data));
  }, [data]);

  const mutation = useMutation({
    mutationFn: (cfg: WidgetConfigData) =>
      apiRequest<{ saved: boolean }>(
        `/admin/projects/${projectId}/widget-config`,
        { method: 'PUT', body: JSON.stringify(cfg) },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widget-config', projectId] });
      toast('已保存', 'success');
    },
    onError: (err: Error) => toast(err.message || '保存失败', 'error'),
  });

  const handleSave = () => {
    if (!projectId) return;
    mutation.mutate(config);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Widget 配置</h1>

      {/* Section 1 — 配置表单 */}
      <div className="rounded-xl border border-surface-3 bg-surface-0 p-5 dark:border-gray-600 dark:bg-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">配置表单</h2>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">主题色</label>
              <input
                type="color"
                value={config.primaryColor}
                onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                className="h-10 w-full cursor-pointer rounded-lg border border-surface-3 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">位置</label>
              <select
                value={config.position}
                onChange={(e) => setConfig({ ...config, position: e.target.value as WidgetConfigData['position'] })}
                className="w-full rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="bottom-right">右下角</option>
                <option value="bottom-left">左下角</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">按钮文字</label>
            <input
              type="text"
              value={config.buttonLabel}
              onChange={(e) => setConfig({ ...config, buttonLabel: e.target.value })}
              maxLength={20}
              className="w-full rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">成功标题</label>
            <input
              type="text"
              value={config.successTitle}
              onChange={(e) => setConfig({ ...config, successTitle: e.target.value })}
              maxLength={50}
              placeholder="默认：提交成功"
              className="w-full rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 text-sm placeholder:text-gray-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">成功提示语</label>
            <textarea
              rows={2}
              value={config.successMessage}
              onChange={(e) => setConfig({ ...config, successMessage: e.target.value })}
              maxLength={200}
              placeholder="默认：感谢您的反馈，我们会尽快处理。"
              className="w-full resize-none rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 text-sm placeholder:text-gray-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500"
            />
          </div>

          <fieldset className="rounded-lg border border-surface-3 p-4 dark:border-gray-600">
            <legend className="px-1 text-xs font-medium text-gray-600 dark:text-gray-400">表单字段</legend>
            <div className="flex gap-6">
              <FieldToggle
                label="优先级选择"
                checked={config.fields.priority}
                onChange={(v) => setConfig({ ...config, fields: { ...config.fields, priority: v } })}
              />
              <FieldToggle
                label="联系方式输入"
                checked={config.fields.contact}
                onChange={(v) => setConfig({ ...config, fields: { ...config.fields, contact: v } })}
              />
              <FieldToggle
                label="分类选择"
                checked={config.fields.category}
                onChange={(v) => setConfig({ ...config, fields: { ...config.fields, category: v } })}
              />
            </div>
          </fieldset>

          <button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {mutation.isPending ? '保存中…' : '保存配置'}
          </button>
        </div>
      </div>

      {/* Section 2 — 实时预览 */}
      <PreviewSection config={config} />

      {/* Section 3 — 嵌入代码 */}
      <EmbedSection origin={window.location.origin} />
    </div>
  );
}

function mergeConfig(base: WidgetConfigData, data: Partial<WidgetConfigData>): WidgetConfigData {
  return {
    ...base,
    ...data,
    fields: { ...base.fields, ...(data.fields ?? {}) },
  };
}

function FieldToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-700 select-none dark:text-gray-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 accent-brand-600 dark:border-gray-600"
      />
      {label}
    </label>
  );
}

function PreviewSection({ config }: { config: WidgetConfigData }) {
  const [tab, setTab] = useState<PreviewTab>('form');

  return (
    <div className="rounded-xl border border-surface-3 bg-surface-0 p-5 dark:border-gray-600 dark:bg-gray-700">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">实时预览</h2>
        <div className="flex gap-1 rounded-lg bg-surface-2 p-1 dark:bg-gray-800">
          {(['form', 'success'] as PreviewTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                tab === t
                  ? 'bg-surface-0 text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              )}
            >
              {t === 'form' ? '表单态' : '成功态'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center rounded-xl bg-gray-50 p-5 dark:bg-gray-800">
        {tab === 'form' ? <FormPreview config={config} /> : <SuccessPreview config={config} />}
      </div>
    </div>
  );
}

function FormPreview({ config }: { config: WidgetConfigData }) {
  const launcherPos = config.position === 'bottom-right' ? 'right-3' : 'left-3';

  return (
    <div className="relative h-72 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-700">
      <div className="p-3">
        <div className="h-2 w-20 rounded bg-gray-200 dark:bg-gray-600" />
        <div className="mt-2 h-2 w-16 rounded bg-gray-100 dark:bg-gray-600" />
        <div className="mt-2 h-2 w-24 rounded bg-gray-100 dark:bg-gray-600" />
      </div>

      <div className={`absolute bottom-3 ${launcherPos}`}>
        <div
          className="rounded-full px-3 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{ backgroundColor: config.primaryColor }}
        >
          {config.buttonLabel}
        </div>
      </div>

      <div
        className={`absolute top-8 ${launcherPos} w-44 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-600 dark:bg-gray-800`}
      >
        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">提交反馈</p>

        <div className="mt-2 h-7 rounded-md border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700" />

        {config.fields.priority && (
          <div className="mt-2 flex gap-1">
            {['低', '中', '高'].map((p) => (
              <span
                key={p}
                className="flex-1 rounded-full border border-gray-200 py-0.5 text-center text-[10px] text-gray-500 dark:border-gray-600 dark:text-gray-400"
              >
                {p}
              </span>
            ))}
          </div>
        )}

        {config.fields.contact && (
          <div className="mt-2 h-6 rounded-md border border-dashed border-gray-300 dark:border-gray-500" />
        )}

        {config.fields.category && (
          <div className="mt-2 flex flex-wrap gap-1">
            {['Bug', '功能', '其他'].map((c) => (
              <span
                key={c}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 dark:bg-gray-700 dark:text-gray-400"
              >
                {c}
              </span>
            ))}
          </div>
        )}

        <button
          className="mt-2 w-full rounded-md py-1 text-[10px] font-medium text-white"
          style={{ backgroundColor: config.primaryColor }}
        >
          提交
        </button>
      </div>
    </div>
  );
}

function SuccessPreview({ config }: { config: WidgetConfigData }) {
  const title = config.successTitle.trim() || '提交成功';
  const message = config.successMessage.trim() || '感谢您的反馈，我们会尽快处理。';

  return (
    <div className="relative h-72 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-700">
      <div className="absolute inset-x-4 bottom-4 top-4 rounded-xl border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-900/30">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-lg text-white">
          ✓
        </div>
        <p className="mt-2 text-xs font-semibold text-gray-900 dark:text-gray-100">{title}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-gray-600 dark:text-gray-400">{message}</p>
      </div>
    </div>
  );
}

function EmbedSection({ origin }: { origin: string }) {
  const navigate = useNavigate();
  const apiUrl = `${origin}/api/v1`;
  const scriptCode = `<!-- Nexus Feedback Widget -->
<script src="${origin}/widget/nexus-feedback-widget.iife.js"></script>
<script>
  NexusFeedbackWidget.mount(document.body, {
    apiKey: 'YOUR_PROJECT_API_KEY',
    apiUrl: '${apiUrl}'
  });
</script>`;
  const esmCode = `import { FeedbackWidget } from '@nexus-feedback/widget';

<FeedbackWidget apiKey="YOUR_PROJECT_API_KEY" apiUrl="${apiUrl}" />`;

  return (
    <div className="rounded-xl border border-surface-3 bg-surface-0 p-5 dark:border-gray-600 dark:bg-gray-700">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">嵌入代码</h2>

      <CodeTabs
        tabs={[
          { id: 'script', label: '<script> 标签接入', code: scriptCode },
          { id: 'esm', label: 'React/ESM 接入', code: esmCode },
        ]}
      />

      <div className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
        <span>⚠</span>
        <span>
          API Key 请在{' '}
          <button
            onClick={() => navigate('/applications')}
            className="font-medium underline hover:no-underline"
          >
            项目接入
          </button>{' '}
          页复制。
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
        将代码粘贴到网站 HTML 的 &lt;/body&gt; 前；保存配置后刷新宿主页面即可生效（Widget 会自动拉取最新配置）。
      </p>
    </div>
  );
}

function CodeTabs({ tabs }: { tabs: { id: string; label: string; code: string }[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? '');
  const active = tabs.find((t) => t.id === activeId);

  return (
    <div className="mt-4">
      <div className="flex gap-1 border-b border-surface-3 pb-2 dark:border-gray-600">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveId(t.id)}
            className={clsx(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              t.id === activeId
                ? 'bg-brand-600 text-white'
                : 'bg-surface-2 text-gray-600 hover:bg-surface-3 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
            )}
          >
            {t.label}
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
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative mt-2">
      <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100 dark:bg-gray-900">
        <code>{highlightApiKey(code)}</code>
      </pre>
      <button
        onClick={handleCopy}
        className={clsx(
          'absolute right-2 top-2 rounded-md px-2 py-1 text-xs font-medium transition-colors',
          copied
            ? 'bg-green-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600',
        )}
      >
        {copied ? '已复制' : '复制'}
      </button>
    </div>
  );
}

function highlightApiKey(code: string): (string | JSX.Element)[] {
  return code.split('YOUR_PROJECT_API_KEY').flatMap((part, i, arr) => {
    if (i === arr.length - 1) return [part];
    return [
      part,
      <span key={i} className="rounded bg-amber-400/20 px-0.5 text-amber-300">
        YOUR_PROJECT_API_KEY
      </span>,
    ];
  });
}
