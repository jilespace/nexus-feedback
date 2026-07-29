import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';
import { useToast } from '@/components/Toast';
import { Skeleton } from '@/components/Skeleton';
import type { SSOConfig } from '@/types';

type ProjectInfo = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

function getBoardUrl(slug: string): string {
  const url = new URL(window.location.href);
  url.port = '8082';
  return `${url.origin}/${slug}`;
}

export function ProjectSettings() {
  const { projectId } = useParams<{ projectId: string }>();
  const { show: toast } = useToast();
  const queryClient = useQueryClient();

  const [notifyAdmin, setNotifyAdmin] = useState(true);
  const [notifyVoters, setNotifyVoters] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);

  const [jwtSecret, setJwtSecret] = useState('');
  const [userIdClaim, setUserIdClaim] = useState('');
  const [emailClaim, setEmailClaim] = useState('');
  const [nameClaim, setNameClaim] = useState('');
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: ssoConfig, isLoading } = useQuery({
    queryKey: ['sso', projectId],
    queryFn: () => apiRequest<SSOConfig | null>(`/org/projects/${projectId}/sso`),
    enabled: !!projectId,
  });

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => apiRequest<ProjectInfo>(`/org/projects/${projectId}`),
    enabled: !!projectId,
  });

  const boardUrl = project ? getBoardUrl(project.slug) : '';

  useEffect(() => {
    if (ssoConfig) {
      setJwtSecret(ssoConfig.jwt_secret || '');
      setUserIdClaim(ssoConfig.user_id_claim || '');
      setEmailClaim(ssoConfig.email_claim || '');
      setNameClaim(ssoConfig.name_claim || '');
      setSsoEnabled(ssoConfig.enabled);
    }
  }, [ssoConfig]);

  const hasExistingConfig = !!ssoConfig?.id;

  const saveMutation = useMutation({
    mutationFn: (body: { jwt_secret: string; user_id_claim?: string; email_claim?: string; name_claim?: string; enabled: boolean }) =>
      apiRequest<SSOConfig>(`/org/projects/${projectId}/sso`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso', projectId] });
      toast('SSO 配置已保存', 'success');
    },
    onError: (err: Error) => toast(err.message || '保存失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiRequest<null>(`/org/projects/${projectId}/sso`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso', projectId] });
      setJwtSecret('');
      setUserIdClaim('');
      setEmailClaim('');
      setNameClaim('');
      setSsoEnabled(false);
      setShowDeleteConfirm(false);
      toast('SSO 配置已删除', 'success');
    },
    onError: (err: Error) => toast(err.message || '删除失败', 'error'),
  });

  const handleSaveSSO = () => {
    if (!jwtSecret.trim()) {
      toast('JWT Secret 不能为空', 'error');
      return;
    }
    saveMutation.mutate({
      jwt_secret: jwtSecret.trim(),
      user_id_claim: userIdClaim.trim() || undefined,
      email_claim: emailClaim.trim() || undefined,
      name_claim: nameClaim.trim() || undefined,
      enabled: ssoEnabled,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/applications"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-3 text-gray-500 transition-colors hover:bg-surface-2"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">项目设置</h1>
      </div>

      {/* 项目信息 */}
      {project && (
        <section className="rounded-xl border border-surface-3 bg-surface-0 p-5 dark:border-gray-600 dark:bg-gray-800">
          <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">项目信息</h2>
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            基本信息及公开看板地址。
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="w-32 shrink-0 text-xs font-medium text-gray-600 dark:text-gray-400">项目名称</label>
              <span className="text-sm text-gray-900 dark:text-gray-100">{project.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="w-32 shrink-0 text-xs font-medium text-gray-600 dark:text-gray-400">项目标识 (Slug)</label>
              <code className="rounded bg-surface-2 px-2 py-0.5 text-sm font-mono text-gray-600 dark:text-gray-300">
                {project.slug}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(project.slug);
                  toast('已复制到剪贴板', 'success');
                }}
                className="rounded-md px-2 py-0.5 text-xs text-gray-500 transition-colors hover:bg-surface-2 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                复制
              </button>
            </div>
            <div className="flex items-center gap-3">
              <label className="w-32 shrink-0 text-xs font-medium text-gray-600 dark:text-gray-400">公开看板地址</label>
              <div className="flex items-center gap-2">
                <code className="rounded bg-surface-2 px-2 py-0.5 text-xs font-mono text-gray-600 dark:text-gray-300">
                  {boardUrl}
                </code>
                <a
                  href={boardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md px-2 py-0.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                >
                  打开 ↗
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(boardUrl);
                    toast('看板地址已复制', 'success');
                  }}
                  className="rounded-md px-2 py-0.5 text-xs text-gray-500 transition-colors hover:bg-surface-2 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  复制链接
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Notification Settings */}
      <section className="rounded-xl border border-surface-3 bg-surface-0 p-5 dark:border-gray-600 dark:bg-gray-800">
        <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">通知设置</h2>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          系统会在状态变更时通知投票者、新反馈时通知管理员，并发送每周摘要。用户可通过邮件中的链接退订。
        </p>
        <div className="space-y-3">
          <ToggleRow label="新反馈通知管理员" checked={notifyAdmin} onChange={setNotifyAdmin} />
          <ToggleRow label="状态变更通知投票者" checked={notifyVoters} onChange={setNotifyVoters} />
          <ToggleRow label="每周摘要" checked={weeklyDigest} onChange={setWeeklyDigest} />
        </div>
      </section>

      {/* SSO Configuration */}
      <section className="rounded-xl border border-surface-3 bg-surface-0 p-5 dark:border-gray-600 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">SSO 配置</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              配置 JWT 单点登录，宿主应用签发 Token 后通过 X-SSO-Token 请求头传递。
            </p>
          </div>
          <ToggleSwitch checked={ssoEnabled} onChange={setSsoEnabled} />
        </div>

        {isLoading ? (
          <Skeleton className="h-48 rounded-lg" variant="rectangular" />
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">JWT Secret</label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={jwtSecret}
                  onChange={(e) => setJwtSecret(e.target.value)}
                  placeholder="输入 JWT 签名密钥"
                  className="w-full rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showSecret ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">User ID Claim</label>
                <input
                  value={userIdClaim}
                  onChange={(e) => setUserIdClaim(e.target.value)}
                  placeholder="sub"
                  className="w-full rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Email Claim</label>
                <input
                  value={emailClaim}
                  onChange={(e) => setEmailClaim(e.target.value)}
                  placeholder="email"
                  className="w-full rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Name Claim</label>
                <input
                  value={nameClaim}
                  onChange={(e) => setNameClaim(e.target.value)}
                  placeholder="name"
                  className="w-full rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSaveSSO}
                disabled={saveMutation.isPending}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                {saveMutation.isPending ? '保存中...' : '保存配置'}
              </button>
              {hasExistingConfig && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-100"
                >
                  删除配置
                </button>
              )}
            </div>

            {showDeleteConfirm && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="mb-2 text-sm text-red-700">确定要删除 SSO 配置吗？此操作不可撤销。</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? '删除中...' : '确认删除'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-lg bg-surface-1 p-3">
              <p className="text-xs leading-relaxed text-gray-500">
                <span className="font-medium text-gray-700">工作原理：</span>宿主应用使用此 Secret 签发 JWT，
                用户请求时通过 <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">X-SSO-Token</code> 请求头传递。
                系统验证签名后自动识别用户身份，无需单独注册。
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-surface-1">
      <span className="text-sm text-gray-700">{label}</span>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </label>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-200 ${checked ? 'bg-brand-600' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
    </button>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 2l12 12M6.5 6.5a2 2 0 002.83 2.83M4.2 4.2C2.8 5.3 1.5 8 1.5 8s2.5 4.5 6.5 4.5c1.3 0 2.4-.4 3.3-1M14.5 8s-.8-1.5-2.2-2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
