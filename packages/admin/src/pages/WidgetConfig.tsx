import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';

type WidgetConfigData = {
  primaryColor: string;
  position: 'bottom-right' | 'bottom-left';
  buttonLabel: string;
};

const defaultConfig: WidgetConfigData = {
  primaryColor: '#4F46E5',
  position: 'bottom-right',
  buttonLabel: '反馈',
};

export function WidgetConfig() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<WidgetConfigData>(defaultConfig);
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({
    queryKey: ['widget-config', projectId],
    queryFn: () =>
      apiRequest<WidgetConfigData | null>(
        `/admin/projects/${projectId}/widget-config`,
      ),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (data) setConfig({ ...defaultConfig, ...data });
  }, [data]);

  const mutation = useMutation({
    mutationFn: (cfg: WidgetConfigData) =>
      apiRequest<{ saved: boolean }>(
        `/admin/projects/${projectId}/widget-config`,
        { method: 'PUT', body: JSON.stringify(cfg) },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widget-config', projectId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleSave = () => {
    if (!projectId) return;
    mutation.mutate(config);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Widget 配置</h1>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4 rounded-xl border border-surface-3 bg-surface-0 p-5 dark:border-gray-600 dark:bg-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">外观设置</h2>
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
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">按钮文字</label>
            <input
              type="text"
              value={config.buttonLabel}
              onChange={(e) => setConfig({ ...config, buttonLabel: e.target.value })}
              className="w-full rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          <button
            onClick={handleSave}
            className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            {saved ? '已保存 ✓' : '保存配置'}
          </button>
        </div>
        <div className="flex items-center justify-center rounded-xl border border-surface-3 bg-gray-50 p-5 dark:border-gray-600 dark:bg-gray-800">
          <div className="relative h-64 w-48 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-700">
            <div className="p-3">
              <div className="h-2 w-20 rounded bg-gray-200 dark:bg-gray-600" />
              <div className="mt-2 h-2 w-16 rounded bg-gray-100 dark:bg-gray-600" />
              <div className="mt-2 h-2 w-24 rounded bg-gray-100 dark:bg-gray-600" />
            </div>
            <div
              className={`absolute bottom-3 ${config.position === 'bottom-right' ? 'right-3' : 'left-3'}`}
            >
              <div
                className="rounded-full px-3 py-1.5 text-xs font-medium text-white shadow-lg"
                style={{ backgroundColor: config.primaryColor }}
              >
                {config.buttonLabel}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
