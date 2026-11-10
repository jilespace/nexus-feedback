import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getProjectSlug,
  resolveProjectIdForUnsubscribe,
  subscribeToUpdates,
  unsubscribeFromUpdates,
} from '../api';
import type { StoredBoardSubscription, SubscribeType } from '../types';
import { AlertIcon, CheckIcon, SpinnerIcon } from './Icons';

const EMAIL_STORAGE_KEY = 'voter_email';
const SUBSCRIPTION_STORAGE_PREFIX = 'board-subscribe-';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBSCRIBE_TYPES: SubscribeType[] = [
  'weekly_digest',
  'status_updates',
  'all',
];

function subscriptionStorageKey(slug: string): string {
  return `${SUBSCRIPTION_STORAGE_PREFIX}${slug || 'default'}`;
}

function readStoredSubscription(slug: string): StoredBoardSubscription | null {
  try {
    const raw = localStorage.getItem(subscriptionStorageKey(slug));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Partial<StoredBoardSubscription>;
    if (typeof record.email !== 'string' || !record.email.trim()) return null;
    if (!SUBSCRIBE_TYPES.includes(record.type as SubscribeType)) return null;
    return {
      email: record.email.trim(),
      type: record.type as SubscribeType,
      projectId:
        typeof record.projectId === 'string' && record.projectId
          ? record.projectId
          : undefined,
    };
  } catch {
    return null;
  }
}

function writeStoredSubscription(
  slug: string,
  subscription: StoredBoardSubscription,
): void {
  try {
    localStorage.setItem(
      subscriptionStorageKey(slug),
      JSON.stringify(subscription),
    );
  } catch {
    /* ignore */
  }
}

function clearStoredSubscription(slug: string): void {
  try {
    localStorage.removeItem(subscriptionStorageKey(slug));
  } catch {
    /* ignore */
  }
}

function readEmail(): string {
  try {
    return localStorage.getItem(EMAIL_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function rememberEmail(email: string): void {
  try {
    localStorage.setItem(EMAIL_STORAGE_KEY, email);
  } catch {
    /* ignore */
  }
}

/**
 * Public board email subscription. Lives in the global footer so it never
 * interrupts the main feedback flow. The saved subscription is scoped per
 * project so switching boards does not leak state.
 */
export function SubscribeCard() {
  const { t } = useTranslation();
  const [subscription, setSubscription] = useState<StoredBoardSubscription | null>(
    () => readStoredSubscription(getProjectSlug()),
  );
  const [email, setEmail] = useState(
    () => readStoredSubscription(getProjectSlug())?.email ?? readEmail(),
  );
  const [type, setType] = useState<SubscribeType>('weekly_digest');
  const [loading, setLoading] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);

  const typeLabels: Record<SubscribeType, string> = {
    weekly_digest: t('subscribe.typeWeekly'),
    status_updates: t('subscribe.typeStatus'),
    all: t('subscribe.typeAll'),
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!value) {
      setFieldError(t('subscribe.errorRequired'));
      emailRef.current?.focus();
      return;
    }
    if (!EMAIL_PATTERN.test(value)) {
      setFieldError(t('subscribe.errorEmail'));
      emailRef.current?.focus();
      return;
    }

    setLoading(true);
    setFieldError('');
    setError('');
    setNotice('');
    try {
      await subscribeToUpdates({ email: value, type });
      const next: StoredBoardSubscription = { email: value, type };
      writeStoredSubscription(getProjectSlug(), next);
      rememberEmail(value);
      setSubscription(next);
      setEmail(value);
    } catch {
      setError(t('subscribe.errorSubmit'));
    } finally {
      setLoading(false);
    }
  }

  async function handleUnsubscribe() {
    if (!subscription || unsubscribing) return;
    setUnsubscribing(true);
    setError('');
    setNotice('');
    try {
      const projectId =
        subscription.projectId ?? (await resolveProjectIdForUnsubscribe());
      if (!projectId) {
        setError(t('subscribe.unsubscribeError'));
        return;
      }
      await unsubscribeFromUpdates({
        email: subscription.email,
        project_id: projectId,
        type: 'all',
      });
      clearStoredSubscription(getProjectSlug());
      setEmail(subscription.email);
      setSubscription(null);
      setNotice(t('subscribe.unsubscribed'));
    } catch {
      setError(t('subscribe.unsubscribeError'));
    } finally {
      setUnsubscribing(false);
    }
  }

  function handleChangeEmail() {
    clearStoredSubscription(getProjectSlug());
    if (subscription) setEmail(subscription.email);
    setSubscription(null);
    setError('');
    setNotice('');
  }

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="subscribe-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="max-w-lg">
          <h2 id="subscribe-title" className="text-14 font-semibold text-ink">
            {t('subscribe.title')}
          </h2>
          <p className="mt-1 text-12 leading-relaxed text-ink-secondary">
            {t('subscribe.description')}
          </p>
        </div>

        <div className="w-full lg:max-w-md">
          {notice && (
            <p
              role="status"
              aria-live="polite"
              className="mb-2 text-11 font-medium text-success"
            >
              {notice}
            </p>
          )}

          {subscription ? (
            <div className="flex w-full flex-col gap-2 rounded-control border border-success/25 bg-success/10 px-3 py-2.5">
              <div
                role="status"
                aria-live="polite"
                className="flex items-start gap-2.5"
              >
                <CheckIcon
                  className="mt-0.5 h-4 w-4 shrink-0 text-success"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-12 font-medium text-ink">
                    {t('subscribe.subscribed')}
                  </p>
                  <p className="mt-0.5 break-words text-11 text-ink-tertiary">
                    {subscription.email} · {typeLabels[subscription.type]}
                  </p>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-control border border-danger/20 bg-danger/10 px-3 py-2 text-12 text-danger"
                >
                  <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pl-[26px]">
                <button
                  type="button"
                  onClick={() => void handleUnsubscribe()}
                  disabled={unsubscribing}
                  aria-busy={unsubscribing}
                  aria-label={t('subscribe.unsubscribeAria', {
                    email: subscription.email,
                  })}
                  className="btn-secondary btn-sm"
                >
                  {unsubscribing && <SpinnerIcon className="h-3.5 w-3.5" />}
                  {unsubscribing
                    ? t('subscribe.unsubscribing')
                    : t('subscribe.unsubscribe')}
                </button>
                <button
                  type="button"
                  onClick={handleChangeEmail}
                  className="text-11 font-medium text-brand underline-offset-2 transition-colors hover:underline"
                >
                  {t('subscribe.changeEmail')}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="w-full" noValidate>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <label htmlFor="subscribe-email" className="sr-only">
                    {t('subscribe.emailLabel')}
                  </label>
                  <input
                    id="subscribe-email"
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setFieldError('');
                    }}
                    placeholder={t('subscribe.emailPlaceholder')}
                    aria-invalid={Boolean(fieldError)}
                    aria-describedby={
                      fieldError ? 'subscribe-email-error' : undefined
                    }
                    autoComplete="email"
                    className={
                      fieldError
                        ? 'field border-danger focus:border-danger focus:ring-danger/15'
                        : 'field'
                    }
                  />
                  {fieldError && (
                    <p
                      id="subscribe-email-error"
                      className="mt-1 text-11 text-danger"
                      role="alert"
                    >
                      {fieldError}
                    </p>
                  )}
                </div>
                <div className="shrink-0 sm:w-40">
                  <label htmlFor="subscribe-type" className="sr-only">
                    {t('subscribe.typeLabel')}
                  </label>
                  <select
                    id="subscribe-type"
                    value={type}
                    onChange={(event) =>
                      setType(event.target.value as SubscribeType)
                    }
                    className="field"
                  >
                    {SUBSCRIBE_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {typeLabels[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="btn-primary w-full shrink-0 sm:w-auto"
                  disabled={loading}
                  aria-busy={loading}
                >
                  {loading && <SpinnerIcon className="h-3.5 w-3.5" />}
                  {loading ? t('subscribe.submitting') : t('subscribe.action')}
                </button>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-2 flex items-start gap-2 rounded-control border border-danger/20 bg-danger/10 px-3 py-2 text-12 text-danger"
                >
                  <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <p className="mt-2 text-11 text-ink-tertiary">
                {t('subscribe.privacy')}
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
