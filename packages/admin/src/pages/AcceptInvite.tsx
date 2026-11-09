import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '@/api/client';
import '@fontsource-variable/instrument-sans/wght.css';
import '@/styles/auth.css';

type FieldErrors = Partial<Record<'password' | 'confirm', string>>;

type Copy = {
  kicker: string;
  title: string;
  subtitle: string;
  invalidTitle: string;
  invalidDesc: string;
  successTitle: string;
  successDesc: string;
  goLogin: string;
  showPassword: string;
  hidePassword: string;
  labelPassword: string;
  labelConfirm: string;
  passwordPlaceholder: string;
  placeholderConfirm: string;
  accepting: string;
  trust: string[];
  passwordHint: string;
  ruleLength: string;
  ruleCase: string;
  ruleNumber: string;
  errPasswordRequired: string;
  errPasswordWeak: string;
  errConfirmRequired: string;
  errPasswordMismatch: string;
  acceptFailed: string;
  existingAccount: string;
  homeAria: string;
  pageNote: string;
  backHome: string;
};

const ZH_COPY: Copy = {
  kicker: '团队邀请',
  title: '接受邀请',
  subtitle: '为你的账号设置密码，完成后即可加入团队并登录工作台。',
  invalidTitle: '邀请链接无效',
  invalidDesc: '链接可能已过期，或已被使用。请联系团队管理员重新发送邀请。',
  successTitle: '邀请已接受',
  successDesc: '账号已激活，请使用邮箱与新密码登录工作台。',
  goLogin: '去登录',
  showPassword: '显示密码',
  hidePassword: '隐藏密码',
  labelPassword: '新密码',
  labelConfirm: '确认密码',
  passwordPlaceholder: '设置新密码',
  placeholderConfirm: '再次输入密码',
  accepting: '接受中...',
  trust: ['开源 MIT 许可', '可自托管部署'],
  passwordHint: '至少 8 位，包含大小写字母和数字',
  ruleLength: '至少 8 位',
  ruleCase: '包含大小写字母',
  ruleNumber: '包含数字',
  errPasswordRequired: '请设置新密码',
  errPasswordWeak: '密码需至少 8 位，且包含大小写字母和数字',
  errConfirmRequired: '请再次输入密码',
  errPasswordMismatch: '两次输入的密码不一致',
  acceptFailed: '接受邀请失败',
  existingAccount: '已有账号？',
  homeAria: 'Nexus Feedback 首页',
  pageNote: '© 2026 Nexus Feedback · 开源的用户反馈管理平台',
  backHome: '返回官网',
};

const EN_COPY: Copy = {
  kicker: 'Team invitation',
  title: 'Accept invitation',
  subtitle: 'Set a password for your account to join the team and sign in.',
  invalidTitle: 'Invitation link is invalid',
  invalidDesc: 'The link may have expired or already been used. Ask your team admin to send a new invitation.',
  successTitle: 'Invitation accepted',
  successDesc: 'Your account is active. Sign in with your email and new password.',
  goLogin: 'Go to sign in',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  labelPassword: 'New password',
  labelConfirm: 'Confirm password',
  passwordPlaceholder: 'Set a new password',
  placeholderConfirm: 'Enter the password again',
  accepting: 'Accepting...',
  trust: ['Open source (MIT)', 'Self-hostable'],
  passwordHint: 'At least 8 characters with upper & lower case letters and a number',
  ruleLength: '8+ characters',
  ruleCase: 'Upper & lower case',
  ruleNumber: 'Contains a number',
  errPasswordRequired: 'Please set a password',
  errPasswordWeak: 'Use 8+ characters with upper & lower case letters and a number',
  errConfirmRequired: 'Please confirm the password',
  errPasswordMismatch: 'Passwords do not match',
  acceptFailed: 'Failed to accept the invitation',
  existingAccount: 'Already have an account?',
  homeAria: 'Nexus Feedback home',
  pageNote: '© 2026 Nexus Feedback · Open-source feedback platform',
  backHome: 'Back to site',
};

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

type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  hint?: string;
  reveal: { show: boolean; toggle: () => void; labelShow: string; labelHide: string };
};

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
  hint,
  reveal,
}: TextFieldProps) {
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
          type={reveal.show ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`auth-input auth-input--with-affix${error ? ' is-invalid' : ''}`}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className="auth-affix"
          onClick={reveal.toggle}
          aria-label={reveal.show ? reveal.labelHide : reveal.labelShow}
        >
          {reveal.show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
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

export function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Match the server password policy (packages/server/src/utils/passwordPolicy.ts).
  const { i18n } = useTranslation();
  const copy = i18n.language.startsWith('en') ? EN_COPY : ZH_COPY;

  const liveMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const passwordRules = [
    { met: /[a-z]/.test(password) && /[A-Z]/.test(password), label: copy.ruleCase },
    { met: /\d/.test(password), label: copy.ruleNumber },
    { met: password.length >= 8, label: copy.ruleLength },
  ];

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setError('');

    const next: FieldErrors = {};
    if (!password) next.password = copy.errPasswordRequired;
    else if (!STRONG_PASSWORD_RE.test(password)) next.password = copy.errPasswordWeak;
    if (!confirmPassword) next.confirm = copy.errConfirmRequired;
    else if (confirmPassword !== password) next.confirm = copy.errPasswordMismatch;
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await apiRequest('/org/accept-invite', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.acceptFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-center">
        <div className="auth-center-bg" aria-hidden="true">
          <div className="auth-center-grid" />
          <div className="auth-center-glow" />
        </div>

        <div className="auth-center-inner">
          <a className="auth-center-brand" href="/" aria-label={copy.homeAria}>
            <span className="auth-logo"><LogoMark /></span>
            <span>
              <span className="auth-wordmark">Nexus Feedback</span>
              <span className="auth-wordmark-sub">Feedback OS</span>
            </span>
          </a>

          <div className="auth-card auth-enter">
            <div className="auth-card-head">
              <p className="auth-card-kicker">{copy.kicker}</p>
              <h1 className="auth-card-title">
                {accepted ? copy.successTitle : !token ? copy.invalidTitle : copy.title}
              </h1>
              {accepted || !token ? null : <p className="auth-card-sub">{copy.subtitle}</p>}
            </div>

            {!token ? (
              <div className="auth-notice">
                <span className="auth-notice-icon auth-notice-icon--danger">
                  <AlertIcon />
                </span>
                <p className="auth-notice-desc">{copy.invalidDesc}</p>
                <button type="button" className="auth-submit" onClick={() => navigate('/dashboard')}>
                  {copy.goLogin}
                </button>
              </div>
            ) : accepted ? (
              <div className="auth-notice">
                <span className="auth-notice-icon">
                  <CheckIcon />
                </span>
                <p className="auth-notice-desc">{copy.successDesc}</p>
                <button type="button" className="auth-submit" onClick={() => navigate('/dashboard')}>
                  {copy.goLogin}
                </button>
              </div>
            ) : (
              <>
                {error && (
                  <div className="auth-alert auth-alert--danger" role="alert">
                    <AlertIcon />
                    <span>{error}</span>
                  </div>
                )}
                <form className="auth-form" onSubmit={handleSubmit} noValidate>
                  <PasswordField
                    id="password"
                    label={copy.labelPassword}
                    value={password}
                    onChange={(value) => {
                      setPassword(value);
                      setFieldErrors({});
                      if (error) setError('');
                    }}
                    placeholder={copy.passwordPlaceholder}
                    autoComplete="new-password"
                    error={fieldErrors.password}
                    reveal={{
                      show: showPassword,
                      toggle: () => setShowPassword((previous) => !previous),
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
                  <PasswordField
                    id="confirm_password"
                    label={copy.labelConfirm}
                    value={confirmPassword}
                    onChange={(value) => {
                      setConfirmPassword(value);
                      setFieldErrors({});
                      if (error) setError('');
                    }}
                    placeholder={copy.placeholderConfirm}
                    autoComplete="new-password"
                    error={fieldErrors.confirm ?? (liveMismatch ? copy.errPasswordMismatch : undefined)}
                    reveal={{
                      show: showConfirmPassword,
                      toggle: () => setShowConfirmPassword((previous) => !previous),
                      labelShow: copy.showPassword,
                      labelHide: copy.hidePassword,
                    }}
                  />
                  <button type="submit" className="auth-submit" disabled={loading} aria-busy={loading}>
                    {loading ? (
                      <>
                        <span className="auth-spinner" aria-hidden="true" />
                        {copy.accepting}
                      </>
                    ) : (
                      copy.title
                    )}
                  </button>
                </form>
              </>
            )}

            {token && !accepted && (
              <p className="auth-form-foot">
                {copy.existingAccount}{' '}
                <button type="button" className="auth-link" onClick={() => navigate('/dashboard')}>
                  {copy.goLogin}
                </button>
              </p>
            )}
          </div>

          <div className="auth-center-foot">
            {copy.trust.map((item) => (
              <span key={item}>
                <CheckIcon />
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
