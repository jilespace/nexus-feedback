import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '@/api/client';

export function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('无效的邀请链接');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) return;

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      await apiRequest('/org/accept-invite', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '接受邀请失败');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'block w-full rounded-xl border border-surface-3 bg-surface-1 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all focus:border-brand-500 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500';
  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400';
  const btnCls = 'relative w-full overflow-hidden rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition-all hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-600/30 focus:outline-none focus:ring-2 focus:ring-brand-200 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none';

  if (!token || error) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-1 dark:bg-gray-900">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="relative w-full max-w-sm">
          <div className="rounded-2xl border border-surface-3 bg-surface-0 p-8 shadow-xl shadow-brand-900/5 dark:border-gray-600 dark:bg-gray-800">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 shadow-lg shadow-brand-600/30">
                <span className="text-lg font-bold text-white">N</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">接受邀请</h1>
              <p className="mt-1.5 text-sm text-gray-500">设置密码以加入团队</p>
            </div>
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-[10px]">!</span>
                {error}
              </div>
            )}
            <div className="text-center text-gray-600 dark:text-gray-400">
              <button onClick={() => navigate('/dashboard')} className="text-brand-600 hover:text-brand-700 font-medium">去登录</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-1 dark:bg-gray-900">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="relative w-full max-w-sm">
          <div className="rounded-2xl border border-surface-3 bg-surface-0 p-8 shadow-xl shadow-brand-900/5 dark:border-gray-600 dark:bg-gray-800">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-600 shadow-lg shadow-green-600/30">
                <span className="text-lg font-bold text-white">✓</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">邀请已接受</h1>
              <p className="mt-1.5 text-sm text-gray-500">您的账户已激活，请使用新密码登录</p>
            </div>
            <button onClick={() => navigate('/dashboard')} className={btnCls}>
              去登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-1 dark:bg-gray-900">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />
      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-surface-3 bg-surface-0 p-8 shadow-xl shadow-brand-900/5 dark:border-gray-600 dark:bg-gray-800">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 shadow-lg shadow-brand-600/30">
              <span className="text-lg font-bold text-white">N</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">接受邀请</h1>
            <p className="mt-1.5 text-sm text-gray-500">设置密码以加入团队</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="password" className={labelCls}>新密码</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="至少8位，含大小写字母和数字"
                required
                minLength={8}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className={labelCls}>确认密码</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputCls}
                placeholder="再次输入密码"
                required
                minLength={8}
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-[10px]">!</span>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className={btnCls}>
              {loading ? '接受中...' : '接受邀请'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}