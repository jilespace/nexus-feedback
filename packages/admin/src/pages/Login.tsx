import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/api/client';

type Tab = 'login' | 'register' | 'forgot';

export function Login() {
  const { t } = useTranslation();
  const { login, register } = useAuth();
  const [tab, setTab] = useState<Tab>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgSlug, setOrgSlug] = useState('');

  // Register fields
  const [regOrgName, setRegOrgName] = useState('');
  const [regSlug, setRegSlug] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');

  // Forgot password fields
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSlug, setForgotSlug] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ email, password, org_slug: orgSlug });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.login_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      setRegisterSuccess(true);
      await register({
        name: regOrgName,
        slug: regSlug,
        email: regEmail,
        password: regPassword,
        display_name: regDisplayName,
      });
    } catch (err) {
      setRegisterSuccess(false);
      setError(err instanceof Error ? err.message : t('login.register_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiRequest('/org/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail, org_slug: forgotSlug }),
      });
      setForgotSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.send_failed'));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'block w-full rounded-xl border border-surface-3 bg-surface-1 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all focus:border-brand-500 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500';
  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400';
  const btnCls = 'relative w-full overflow-hidden rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition-all hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-600/30 focus:outline-none focus:ring-2 focus:ring-brand-200 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-1 dark:bg-gray-900">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-200 opacity-20 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-brand-300 opacity-15 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-surface-3 bg-surface-0 p-8 shadow-xl shadow-brand-900/5 dark:border-gray-600 dark:bg-gray-800">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 shadow-lg shadow-brand-600/30">
              <span className="text-lg font-bold text-white">N</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('login.title')}</h1>
            <p className="mt-1.5 text-sm text-gray-500">{t('login.subtitle')}</p>
          </div>
          <div className="mb-6 flex rounded-lg bg-surface-1 p-1">
            <button type="button" onClick={() => { setTab('login'); setError(''); }} className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${tab === 'login' ? 'bg-surface-0 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t('login.tab_login')}
            </button>
            <button type="button" onClick={() => { setTab('register'); setError(''); }} className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${tab === 'register' ? 'bg-surface-0 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t('login.tab_register')}
            </button>
          </div>
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-[10px]">!</span>
              {error}
            </div>
          )}
          {registerSuccess && !error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-[10px]">✓</span>
              注册成功！正在为您登录...
            </div>
          )}
          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="org_slug" className={labelCls}>组织标识</label>
                <input id="org_slug" type="text" value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} className={inputCls} placeholder="your-org-slug" required />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="email" className={labelCls}>邮箱</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@example.com" required />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className={labelCls}>密码</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="请输入密码" required />
              </div>
              <button type="submit" disabled={loading} className={btnCls}>{loading ? t('login.logging_in') : t('login.login_btn')}</button>
              <p className="mt-3 text-center text-xs text-gray-400">
                <a href="#forgot" onClick={(e) => { e.preventDefault(); setTab('forgot'); }} className="text-brand-600 hover:text-brand-700">{t('login.forgot')}</a>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="reg_org_name" className={labelCls}>组织名称</label>
                <input id="reg_org_name" type="text" value={regOrgName} onChange={(e) => setRegOrgName(e.target.value)} className={inputCls} placeholder="我的团队" required />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reg_slug" className={labelCls}>组织标识</label>
                <input id="reg_slug" type="text" value={regSlug} onChange={(e) => setRegSlug(e.target.value)} className={inputCls} placeholder="my-team (URL友好)" required />
                <p className="text-xs text-gray-400">仅支持小写字母、数字和连字符</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reg_email" className={labelCls}>邮箱</label>
                <input id="reg_email" type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className={inputCls} placeholder="you@example.com" required />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reg_display_name" className={labelCls}>显示名称</label>
                <input id="reg_display_name" type="text" value={regDisplayName} onChange={(e) => setRegDisplayName(e.target.value)} className={inputCls} placeholder="张三" required />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reg_password" className={labelCls}>密码</label>
                <input id="reg_password" type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className={inputCls} placeholder="至少6位" required minLength={6} />
                <p className="text-xs text-gray-400">至少 6 个字符</p>
              </div>
              <button type="submit" disabled={loading} className={btnCls}>{loading ? t('login.registering') : t('login.register_btn')}</button>
            </form>
          )}
          {tab === 'forgot' && (
            <div className="space-y-4">
              {forgotSent ? (
                <div className="rounded-lg bg-green-50 px-3 py-4 text-center text-sm text-green-700">
                  <p>如果该邮箱已注册，重置链接已发送到您的邮箱。</p>
                  <button onClick={() => { setTab('login'); setForgotSent(false); }} className="mt-3 text-brand-600 hover:text-brand-700 text-xs font-medium">返回登录</button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="forgot_slug" className={labelCls}>组织标识</label>
                    <input id="forgot_slug" type="text" value={forgotSlug} onChange={(e) => setForgotSlug(e.target.value)} className={inputCls} placeholder="your-org-slug" required />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="forgot_email" className={labelCls}>邮箱</label>
                    <input id="forgot_email" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className={inputCls} placeholder="you@example.com" required />
                  </div>
                  <button type="submit" disabled={loading} className={btnCls}>{loading ? '发送中...' : '发送重置链接'}</button>
                  <p className="text-center text-xs text-gray-400">
                    <a href="#login" onClick={(e) => { e.preventDefault(); setTab('login'); }} className="text-brand-600 hover:text-brand-700">返回登录</a>
                  </p>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
