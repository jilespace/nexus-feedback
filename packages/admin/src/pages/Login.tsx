import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/api/client';
import '@fontsource-variable/instrument-sans/wght.css';
import '@/styles/auth.css';

type Tab = 'login' | 'register' | 'forgot';

type FieldErrors = Partial<Record<
  | 'org_slug'
  | 'email'
  | 'password'
  | 'reg_org_name'
  | 'reg_slug'
  | 'reg_email'
  | 'reg_display_name'
  | 'reg_password'
  | 'forgot_slug'
  | 'forgot_email',
  string
>>;

type Copy = {
  brandKicker: string;
  brandHeadline: string;
  brandDesc: string;
  points: Array<{ title: string; desc: string }>;
  panelNoteLabel: string;
  panelNoteTitle: string;
  panelNoteMeta: string;
  panelNoteTime: string;
  panelNoteStatus: string;
  panelTrust: string[];
  titleLogin: string;
  subLogin: string;
  titleRegister: string;
  subRegister: string;
  titleForgot: string;
  subForgot: string;
  forgotSentTitle: string;
  tabsLabel: string;
  showPassword: string;
  hidePassword: string;
  placeholderOrgName: string;
  placeholderDisplayName: string;
  placeholderPassword: string;
  passwordHint: string;
  ruleLength: string;
  ruleCase: string;
  ruleNumber: string;
  pageNote: string;
  backHome: string;
  errors: {
    orgSlugRequired: string;
    orgSlugInvalid: string;
    emailRequired: string;
    emailInvalid: string;
    passwordRequired: string;
    orgNameRequired: string;
    displayNameRequired: string;
    passwordWeak: string;
    passwordMismatch: string;
  };
};

const ZH_COPY: Copy = {
  brandKicker: '组织管理后台',
  brandHeadline: '让每一条反馈，都有人回应。',
  brandDesc: '把分散在 Widget、提交页与公开看板里的用户声音，收进一个安静、清晰的工作台。',
  points: [
    { title: '统一收件箱', desc: '四个渠道的反馈汇入同一列表，来源、分类与状态一眼可见。' },
    { title: '实时洞察', desc: '投票趋势、来源分布与首次响应时间，衡量团队响应质量。' },
    { title: '安全与审计', desc: '多租户隔离、Webhook HMAC 签名与完整审计日志。' },
  ],
  panelNoteLabel: '实时动态',
  panelNoteTitle: '「希望支持深色模式」已标记为处理中',
  panelNoteMeta: 'Widget · 234 票',
  panelNoteTime: '12 分钟前',
  panelNoteStatus: '处理中',
  panelTrust: ['开源 MIT 许可', '可自托管部署', '数据留在自有基础设施'],
  titleLogin: '登录到工作台',
  subLogin: '使用组织标识与成员账号登录。',
  titleRegister: '创建新组织',
  subRegister: '注册后你将作为所有者进入工作台。',
  titleForgot: '重置密码',
  subForgot: '填写组织标识与邮箱，我们会发送重置链接。',
  forgotSentTitle: '请查收邮件',
  tabsLabel: '登录或注册',
  showPassword: '显示密码',
  hidePassword: '隐藏密码',
  placeholderOrgName: '我的团队',
  placeholderDisplayName: '张三',
  placeholderPassword: '请输入密码',
  passwordHint: '至少 8 位，包含大小写字母和数字',
  ruleLength: '至少 8 位',
  ruleCase: '包含大小写字母',
  ruleNumber: '包含数字',
  pageNote: '© 2026 Nexus Feedback · 开源的用户反馈管理平台',
  backHome: '返回官网',
  errors: {
    orgSlugRequired: '请输入组织标识',
    orgSlugInvalid: '仅支持小写字母、数字和连字符',
    emailRequired: '请输入邮箱',
    emailInvalid: '邮箱格式不正确',
    passwordRequired: '请输入密码',
    orgNameRequired: '请输入组织名称',
    displayNameRequired: '请输入显示名称',
    passwordWeak: '密码需至少 8 位，且包含大小写字母和数字',
    passwordMismatch: '两次输入的密码不一致',
  },
};

const EN_COPY: Copy = {
  brandKicker: 'Organization Admin',
  brandHeadline: 'Every voice gets an answer.',
  brandDesc: 'Nexus Feedback gathers user voices from the widget, submit page and public board into one quiet, legible workspace.',
  points: [
    { title: 'One inbox', desc: 'Feedback from four channels lands in one list with source and status.' },
    { title: 'Live insight', desc: 'Vote trends, source mix and first response time in one metric set.' },
    { title: 'Secure by default', desc: 'Tenant isolation, signed webhooks and a full audit log.' },
  ],
  panelNoteLabel: 'Live activity',
  panelNoteTitle: '“Dark mode support” was marked in progress',
  panelNoteMeta: 'Widget · 234 votes',
  panelNoteTime: '12 min ago',
  panelNoteStatus: 'In progress',
  panelTrust: ['Open source (MIT)', 'Self-hostable', 'Your data stays yours'],
  titleLogin: 'Sign in to your workspace',
  subLogin: 'Use your organization slug and member account.',
  titleRegister: 'Create an organization',
  subRegister: 'You will join the workspace as the owner.',
  titleForgot: 'Reset your password',
  subForgot: 'Enter your organization slug and email, and we will send a reset link.',
  forgotSentTitle: 'Check your inbox',
  tabsLabel: 'Sign in or register',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  placeholderOrgName: 'My team',
  placeholderDisplayName: 'Jane Doe',
  placeholderPassword: 'Enter your password',
  passwordHint: 'At least 8 characters with upper & lower case letters and a number',
  ruleLength: '8+ characters',
  ruleCase: 'Upper & lower case',
  ruleNumber: 'Contains a number',
  pageNote: '© 2026 Nexus Feedback · Open-source feedback platform',
  backHome: 'Back to site',
  errors: {
    orgSlugRequired: 'Organization slug is required',
    orgSlugInvalid: 'Only lowercase letters, numbers and hyphens',
    emailRequired: 'Email is required',
    emailInvalid: 'Invalid email address',
    passwordRequired: 'Password is required',
    orgNameRequired: 'Organization name is required',
    displayNameRequired: 'Display name is required',
    passwordWeak: 'Use 8+ characters with upper & lower case letters and a number',
    passwordMismatch: 'Passwords do not match',
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STRONG_PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function LogoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2.5 4.5A2 2 0 0 1 4.5 2.5h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-3.6 2.8a.5.5 0 0 1-.9-.4V12.5h-1a2 2 0 0 1-2-2v-6Z"
        fill="white"
        fillOpacity="0.94"
      />
      <circle cx="6.2" cy="7.5" r="0.9" fill="#3D5AFE" />
      <circle cx="9" cy="7.5" r="0.9" fill="#3D5AFE" />
      <circle cx="11.8" cy="7.5" r="0.9" fill="#3D5AFE" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 9.5 3.8 3.8A1.5 1.5 0 0 1 5.2 3h5.6a1.5 1.5 0 0 1 1.4.8L14 9.5" />
      <path d="M2 9.5h3.2l.9 1.7h3.8l.9-1.7H14v2.7a1.4 1.4 0 0 1-1.4 1.3H3.4A1.4 1.4 0 0 1 2 12.2V9.5Z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2.5 13.5v-3M6.2 13.5V7.4M9.8 13.5V9.6M13.5 13.5V4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg {...iconProps}>
      <path d="M8 2 3.5 3.7v3.9c0 2.7 1.8 5 4.5 6.4 2.7-1.4 4.5-3.7 4.5-6.4V3.7L8 2Z" />
      <path d="m5.9 8 1.5 1.5 2.9-3" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M1.8 8S4 3.8 8 3.8 14.2 8 14.2 8 12 12.2 8 12.2 1.8 8 1.8 8Z" />
      <circle cx="8" cy="8" r="1.9" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6.3 3.9A6.7 6.7 0 0 1 8 3.8c4 0 6.2 4.2 6.2 4.2a11.4 11.4 0 0 1-2.1 2.7M4.2 5.2A11.6 11.6 0 0 0 1.8 8s2.2 4.2 6.2 4.2a6.5 6.5 0 0 0 2.3-.4" />
      <path d="m2.5 2.5 11 11" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5.2v3.4M8 11h.01" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...iconProps}>
      <path d="m3 8.5 3 3L13 4.5" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg {...iconProps} width={14} height={14}>
      <path d="M13 8H2.5M6.5 3.5 2 8l4.5 4.5" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg {...iconProps} width={14} height={14}>
      <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" />
    </svg>
  );
}

type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password';
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  hint?: string;
  reveal?: { show: boolean; toggle: () => void; labelShow: string; labelHide: string };
};

function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  error,
  hint,
  reveal,
}: TextFieldProps) {
  const inputType = type === 'password' && reveal && !reveal.show ? 'text' : type;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={id}>
        {label}
      </label>
      <div className="auth-input-wrap">
        <input
          id={id}
          name={id}
          type={inputType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`auth-input${reveal ? ' auth-input--with-affix' : ''}${error ? ' is-invalid' : ''}`}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        {reveal && (
          <button
            type="button"
            className="auth-affix"
            onClick={reveal.toggle}
            aria-label={reveal.show ? reveal.labelHide : reveal.labelShow}
          >
            {reveal.show ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {error ? (
        <p className="auth-error" id={`${id}-error`} role="alert">
          <AlertIcon />
          {error}
        </p>
      ) : hint ? (
        <p className="auth-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const panelPointIcons = [<InboxIcon />, <ChartIcon />, <ShieldIcon />];

export function Login() {
  const { t, i18n } = useTranslation();
  const { login, register } = useAuth();
  const copy = i18n.language.startsWith('en') ? EN_COPY : ZH_COPY;

  const [tab, setTab] = useState<Tab>('login');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register fields
  const [regOrgName, setRegOrgName] = useState('');
  const [regSlug, setRegSlug] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Forgot password fields
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSlug, setForgotSlug] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const switchTab = (next: Tab) => {
    setTab(next);
    setError('');
    setFieldErrors({});
    setForgotSent(false);
  };

  const onField = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (error) setError('');
    setFieldErrors({});
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const next: FieldErrors = {};
    if (!orgSlug.trim()) next.org_slug = copy.errors.orgSlugRequired;
    else if (!SLUG_RE.test(orgSlug.trim())) next.org_slug = copy.errors.orgSlugInvalid;
    if (!email.trim()) next.email = copy.errors.emailRequired;
    else if (!EMAIL_RE.test(email.trim())) next.email = copy.errors.emailInvalid;
    if (!password) next.password = copy.errors.passwordRequired;
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await login({ email: email.trim(), password, org_slug: orgSlug.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.login_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const next: FieldErrors = {};
    if (!regOrgName.trim()) next.reg_org_name = copy.errors.orgNameRequired;
    if (!regSlug.trim()) next.reg_slug = copy.errors.orgSlugRequired;
    else if (!SLUG_RE.test(regSlug.trim())) next.reg_slug = copy.errors.orgSlugInvalid;
    if (!regEmail.trim()) next.reg_email = copy.errors.emailRequired;
    else if (!EMAIL_RE.test(regEmail.trim())) next.reg_email = copy.errors.emailInvalid;
    if (!regDisplayName.trim()) next.reg_display_name = copy.errors.displayNameRequired;
    if (!regPassword) next.reg_password = copy.errors.passwordRequired;
    else if (!STRONG_PASSWORD_RE.test(regPassword)) next.reg_password = copy.errors.passwordWeak;
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await register({
        name: regOrgName.trim(),
        slug: regSlug.trim(),
        email: regEmail.trim(),
        password: regPassword,
        display_name: regDisplayName.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.register_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const next: FieldErrors = {};
    if (!forgotSlug.trim()) next.forgot_slug = copy.errors.orgSlugRequired;
    else if (!SLUG_RE.test(forgotSlug.trim())) next.forgot_slug = copy.errors.orgSlugInvalid;
    if (!forgotEmail.trim()) next.forgot_email = copy.errors.emailRequired;
    else if (!EMAIL_RE.test(forgotEmail.trim())) next.forgot_email = copy.errors.emailInvalid;
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await apiRequest('/org/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail.trim(), org_slug: forgotSlug.trim() }),
      });
      setForgotSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.send_failed'));
    } finally {
      setLoading(false);
    }
  };

  const passwordRules = [
    { met: /[a-z]/.test(regPassword) && /[A-Z]/.test(regPassword), label: copy.ruleCase },
    { met: /\d/.test(regPassword), label: copy.ruleNumber },
    { met: regPassword.length >= 8, label: copy.ruleLength },
  ];

  const title = tab === 'login' ? copy.titleLogin : tab === 'register' ? copy.titleRegister : copy.titleForgot;
  const subtitle = tab === 'login' ? copy.subLogin : tab === 'register' ? copy.subRegister : copy.subForgot;

  return (
    <div className="auth">
      <div className="auth-shell">
        <aside className="auth-brand">
          <div className="auth-brand-grid" aria-hidden="true" />
          <div className="auth-brand-glow auth-brand-glow-a" aria-hidden="true" />
          <div className="auth-brand-glow auth-brand-glow-b" aria-hidden="true" />
          <div className="auth-brand-ring" aria-hidden="true" />

          <div className="auth-brand-top">
            <a className="auth-brand-link" href="/" aria-label="Nexus Feedback 首页">
              <span className="auth-logo"><LogoMark /></span>
              <span>
                <span className="auth-wordmark">Nexus Feedback</span>
                <span className="auth-wordmark-sub">Feedback OS</span>
              </span>
            </a>
            <span className="auth-version">v2.0</span>
          </div>

          <div className="auth-brand-body">
            <p className="auth-brand-kicker">{copy.brandKicker}</p>
            <p className="auth-brand-h1">{copy.brandHeadline}</p>
            <p className="auth-brand-desc">{copy.brandDesc}</p>
            <ul className="auth-brand-list">
              {copy.points.map((point, index) => (
                <li key={point.title} className="auth-brand-item">
                  <span className="auth-brand-item-icon">{panelPointIcons[index] ?? null}</span>
                  <span>
                    <span className="auth-brand-item-title">{point.title}</span>
                    <p className="auth-brand-item-desc">{point.desc}</p>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="auth-brand-note-wrap">
            <div className="auth-panel-note">
              <p className="auth-panel-note-label">
                <span className="auth-panel-dot" />
                {copy.panelNoteLabel}
              </p>
              <p className="auth-panel-note-title">{copy.panelNoteTitle}</p>
              <div className="auth-panel-note-meta">
                <span className="auth-chip auth-chip--info">{copy.panelNoteStatus}</span>
                <span>{copy.panelNoteMeta}</span>
                <span>·</span>
                <span>{copy.panelNoteTime}</span>
              </div>
            </div>
            <div className="auth-brand-foot">
              {copy.panelTrust.map((item) => (
                <span key={item}>
                  <CheckIcon />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </aside>

        <main className="auth-main">
          <div className="auth-card auth-enter">
            <div className="auth-card-head">
              <p className="auth-card-kicker">{t('login.subtitle')}</p>
              <h1 className="auth-card-title">{title}</h1>
              <p className="auth-card-sub">{subtitle}</p>
            </div>

            {tab !== 'forgot' && (
              <div className="auth-tabs" role="tablist" aria-label={copy.tabsLabel}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'login'}
                  className="auth-tab"
                  onClick={() => switchTab('login')}
                >
                  {t('login.tab_login')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'register'}
                  className="auth-tab"
                  onClick={() => switchTab('register')}
                >
                  {t('login.tab_register')}
                </button>
              </div>
            )}

            {error && (
              <div className="auth-alert auth-alert--danger" role="alert">
                <AlertIcon />
                <span>{error}</span>
              </div>
            )}

            {tab === 'login' && (
              <form className="auth-form" onSubmit={handleLogin} noValidate>
                <TextField
                  id="org_slug"
                  label={t('login.org_slug')}
                  value={orgSlug}
                  onChange={onField(setOrgSlug)}
                  placeholder="your-org-slug"
                  autoComplete="organization"
                  error={fieldErrors.org_slug}
                />
                <TextField
                  id="email"
                  type="email"
                  label={t('login.email')}
                  value={email}
                  onChange={onField(setEmail)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  error={fieldErrors.email}
                />
                <TextField
                  id="password"
                  type="password"
                  label={t('login.password')}
                  value={password}
                  onChange={onField(setPassword)}
                  placeholder={copy.placeholderPassword}
                  autoComplete="current-password"
                  error={fieldErrors.password}
                  reveal={{
                    show: showLoginPassword,
                    toggle: () => setShowLoginPassword((previous) => !previous),
                    labelShow: copy.showPassword,
                    labelHide: copy.hidePassword,
                  }}
                />
                <div className="auth-row">
                  <button type="button" className="auth-link ml-auto" onClick={() => switchTab('forgot')}>
                    {t('login.forgot')}
                  </button>
                </div>
                <button type="submit" className="auth-submit" disabled={loading} aria-busy={loading}>
                  {loading ? (
                    <>
                      <span className="auth-spinner" aria-hidden="true" />
                      {t('login.logging_in')}
                    </>
                  ) : (
                    <>
                      {t('login.login_btn')}
                      <ArrowRightIcon />
                    </>
                  )}
                </button>
              </form>
            )}

            {tab === 'register' && (
              <form className="auth-form" onSubmit={handleRegister} noValidate>
                <TextField
                  id="reg_org_name"
                  label={t('login.org_name')}
                  value={regOrgName}
                  onChange={onField(setRegOrgName)}
                  placeholder={copy.placeholderOrgName}
                  autoComplete="organization"
                  error={fieldErrors.reg_org_name}
                />
                <TextField
                  id="reg_slug"
                  label={t('login.org_slug')}
                  value={regSlug}
                  onChange={onField(setRegSlug)}
                  placeholder="my-team"
                  autoComplete="off"
                  hint={t('login.slug_hint')}
                  error={fieldErrors.reg_slug}
                />
                <TextField
                  id="reg_email"
                  type="email"
                  label={t('login.email')}
                  value={regEmail}
                  onChange={onField(setRegEmail)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  error={fieldErrors.reg_email}
                />
                <TextField
                  id="reg_display_name"
                  label={t('login.display_name')}
                  value={regDisplayName}
                  onChange={onField(setRegDisplayName)}
                  placeholder={copy.placeholderDisplayName}
                  autoComplete="name"
                  error={fieldErrors.reg_display_name}
                />
                <div className="auth-field">
                  <TextField
                    id="reg_password"
                    type="password"
                    label={t('login.password')}
                    value={regPassword}
                    onChange={onField(setRegPassword)}
                    placeholder={copy.placeholderPassword}
                    autoComplete="new-password"
                    error={fieldErrors.reg_password}
                    reveal={{
                      show: showRegPassword,
                      toggle: () => setShowRegPassword((previous) => !previous),
                      labelShow: copy.showPassword,
                      labelHide: copy.hidePassword,
                    }}
                  />
                  <ul className="auth-reqs" aria-live="polite">
                    {passwordRules.map((rule) => (
                      <li key={rule.label} className={rule.met ? 'auth-req is-met' : 'auth-req'}>
                        {rule.met ? <CheckIcon /> : <span className="auth-req-dot" aria-hidden="true" />}
                        {rule.label}
                      </li>
                    ))}
                  </ul>
                </div>
                <button type="submit" className="auth-submit" disabled={loading} aria-busy={loading}>
                  {loading ? (
                    <>
                      <span className="auth-spinner" aria-hidden="true" />
                      {t('login.registering')}
                    </>
                  ) : (
                    <>
                      {t('login.register_btn')}
                      <ArrowRightIcon />
                    </>
                  )}
                </button>
              </form>
            )}

            {tab === 'forgot' && (
              <>
                {forgotSent ? (
                  <div className="auth-notice">
                    <span className="auth-notice-icon"><CheckIcon /></span>
                    <p className="auth-notice-title">{copy.forgotSentTitle}</p>
                    <p className="auth-notice-desc">{t('login.forgot_sent')}</p>
                    <button type="button" className="auth-submit" onClick={() => switchTab('login')}>
                      {t('login.forgot_back')}
                    </button>
                  </div>
                ) : (
                  <>
                    <button type="button" className="auth-back" onClick={() => switchTab('login')}>
                      <ArrowLeftIcon />
                      {t('login.forgot_back')}
                    </button>
                    <form className="auth-form" onSubmit={handleForgotPassword} noValidate>
                      <TextField
                        id="forgot_slug"
                        label={t('login.org_slug')}
                        value={forgotSlug}
                        onChange={onField(setForgotSlug)}
                        placeholder="your-org-slug"
                        autoComplete="organization"
                        error={fieldErrors.forgot_slug}
                      />
                      <TextField
                        id="forgot_email"
                        type="email"
                        label={t('login.email')}
                        value={forgotEmail}
                        onChange={onField(setForgotEmail)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        error={fieldErrors.forgot_email}
                      />
                      <button type="submit" className="auth-submit" disabled={loading} aria-busy={loading}>
                        {loading ? (
                          <>
                            <span className="auth-spinner" aria-hidden="true" />
                            {t('login.forgot_sending')}
                          </>
                        ) : (
                          t('login.forgot_btn')
                        )}
                      </button>
                    </form>
                  </>
                )}
              </>
            )}
          </div>

          <p className="auth-page-note">
            {copy.pageNote} · <a href="/">{copy.backHome}</a>
          </p>
        </main>
      </div>
    </div>
  );
}
