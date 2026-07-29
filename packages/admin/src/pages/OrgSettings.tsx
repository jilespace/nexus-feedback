import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';
import { useToast } from '@/components/Toast';

type OrgSettingsData = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
};

export function OrgSettings() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [brandColor, setBrandColor] = useState('#4c6ef5');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [initialized, setInitialized] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => apiRequest<OrgSettingsData>('/org/settings'),
  });

  if (data && !initialized) {
    setName(data.name);
    setLogoUrl(data.logo_url ?? '');
    setBrandColor(data.brand_color);
    setInitialized(true);
  }

  const settingsMutation = useMutation({
    mutationFn: (body: { name?: string; logo_url?: string; brand_color?: string }) =>
      apiRequest('/org/settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-settings'] });
      toast.show('设置已保存');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '保存失败', 'error'),
  });

  const passwordMutation = useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      apiRequest('/org/change-password', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.show('密码已修改');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '修改失败', 'error'),
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    settingsMutation.mutate({ name, logo_url: logoUrl || undefined, brand_color: brandColor });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.show('两次输入的密码不一致', 'error');
      return;
    }
    passwordMutation.mutate({ current_password: currentPassword, new_password: newPassword });
  };

  if (isLoading) {
    return <div className="text-sm text-gray-400">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">组织设置</h1>

      <form onSubmit={handleSaveSettings} className="space-y-4 rounded-xl border border-surface-3 bg-surface-0 p-6 dark:border-gray-600 dark:bg-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">基本信息</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">组织名称</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-surface-3 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Logo URL</label>
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
            className="w-full rounded-lg border border-surface-3 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">品牌颜色</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-surface-3 dark:border-gray-600"
            />
            <input
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="w-32 rounded-lg border border-surface-3 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={settingsMutation.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {settingsMutation.isPending ? '保存中...' : '保存设置'}
        </button>
      </form>

      <form onSubmit={handleChangePassword} className="space-y-4 rounded-xl border border-surface-3 bg-surface-0 p-6 dark:border-gray-600 dark:bg-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">修改密码</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">当前密码</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-lg border border-surface-3 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">新密码</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-surface-3 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">确认新密码</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-surface-3 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        <button
          type="submit"
          disabled={passwordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {passwordMutation.isPending ? '修改中...' : '修改密码'}
        </button>
      </form>
    </div>
  );
}
