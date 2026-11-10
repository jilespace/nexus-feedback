import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ApiRequestError,
  unsubscribeFromUpdates,
  verifyUnsubscribeToken,
} from '../api';
import type { SubscribeType, UnsubscribeTokenPayload } from '../types';
import { usePageMeta } from '../lib/meta';
import { AlertIcon, CheckIcon, ChevronLeftIcon, InboxIcon, SpinnerIcon } from '../components/Icons';

type PageState =
  | 'loading'
  | 'ready'
  | 'submitting'
  | 'done'
  | 'invalid'
  | 'expired'
  | 'error';

const TYPE_LABEL_KEYS: Record<SubscribeType, string> = {
  weekly_digest: 'subscribe.typeWeekly',
  status_updates: 'subscribe.typeStatus',
  all: 'subscribe.typeAll',
};

export function Unsubscribe({ projectName }: { projectName: string }) {
  const { t } = useTranslation();
  const { projectSlug } = useParams<{ projectSlug: string }>();
  const base = `/${projectSlug ?? ''}`;
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [state, setState] = useState<PageState>('loading');
  const [payload, setPayload] = useState<UnsubscribeTokenPayload | null>(null);
  const [actionError, setActionError] = useState('');

  usePageMeta({
    title: t('meta.unsubscribeTitle', { project: projectName }),
    description: t('unsubscribe.subtitle'),
    siteName: projectName,
    path: `${base}/unsubscribe`,
  });

  const load = useCallback(async () => {
    if (!token) {
      setState('invalid');
      return;
    }
    setState('loading');
    setActionError('');
    try {
      const data = await verifyUnsubscribeToken(token);
      setPayload(data);
      setState('ready');
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.code === 40002) {
          setState('expired');
          return;
        }
        if (error.status === 400) {
          setState('invalid');
          return;
        }
      }
      setState('error');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmUnsubscribe() {
    if (!payload || state === 'submitting') return;
    setState('submitting');
    setActionError('');
    try {
      await unsubscribeFromUpdates({
        email: payload.email,
        project_id: payload.project_id,
        type: 'all',
      });
      setState('done');
    } catch {
      setState('ready');
      setActionError(t('unsubscribe.errorDescription'));
    }
  }

  const backLink = (
    <Link
      to={base}
      className="mb-6 inline-flex items-center gap-1 text-12 font-medium text-ink-secondary transition-colors duration-150 hover:text-ink"
    >
      <ChevronLeftIcon className="h-3.5 w-3.5" aria-hidden="true" />
      {t('unsubscribe.backToBoard')}
    </Link>
  );

  const typeLabel =
    payload && payload.type in TYPE_LABEL_KEYS
      ? t(TYPE_LABEL_KEYS[payload.type])
      : '';

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-16">
      {backLink}

      <div className="card p-6 text-center sm:p-8">
        {state === 'loading' && (
          <div role="status" aria-live="polite" className="py-6">
            <SpinnerIcon className="mx-auto h-6 w-6 text-ink-tertiary" />
            <p className="mt-4 text-13 text-ink-secondary">
              {t('unsubscribe.loading')}
            </p>
          </div>
        )}

        {(state === 'invalid' || state === 'expired' || state === 'error') && (
          <div role="alert" className="flex flex-col items-center py-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-danger/20 bg-danger/10 text-danger">
              <AlertIcon className="h-5 w-5" />
            </div>
            <h1 className="mt-4 text-18 font-semibold text-ink">
              {state === 'expired'
                ? t('unsubscribe.expiredTitle')
                : state === 'error'
                  ? t('unsubscribe.errorTitle')
                  : t('unsubscribe.invalidTitle')}
            </h1>
            <p className="mt-1.5 max-w-sm text-13 leading-relaxed text-ink-secondary">
              {state === 'expired'
                ? t('unsubscribe.expiredDescription')
                : state === 'error'
                  ? t('unsubscribe.errorDescription')
                  : t('unsubscribe.invalidDescription')}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {state === 'error' && (
                <button
                  type="button"
                  onClick={() => void load()}
                  className="btn-primary"
                >
                  {t('unsubscribe.retry')}
                </button>
              )}
              <Link to={base} className="btn-secondary">
                {t('unsubscribe.backToBoard')}
              </Link>
            </div>
          </div>
        )}

        {(state === 'ready' || state === 'submitting') && payload && (
          <div className="flex flex-col items-center py-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line-subtle bg-surface-subtle text-ink-secondary">
              <InboxIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-18 font-semibold text-ink">
              {t('unsubscribe.confirmTitle')}
            </h1>
            <p className="mt-1.5 max-w-md text-13 leading-relaxed text-ink-secondary">
              {t('unsubscribe.confirmDescription', {
                email: payload.email,
                type: typeLabel,
              })}
            </p>
            <p className="mt-2 max-w-md text-11 text-ink-tertiary">
              {t('unsubscribe.confirmHint')}
            </p>

            {actionError && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-control border border-danger/20 bg-danger/10 px-3 py-2 text-left text-12 text-danger"
              >
                <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => void confirmUnsubscribe()}
                disabled={state === 'submitting'}
                aria-busy={state === 'submitting'}
                className="btn-primary"
              >
                {state === 'submitting' && (
                  <SpinnerIcon className="h-3.5 w-3.5" />
                )}
                {state === 'submitting'
                  ? t('unsubscribe.submitting')
                  : t('unsubscribe.confirmAction')}
              </button>
              <Link to={base} className="btn-secondary">
                {t('unsubscribe.cancelAction')}
              </Link>
            </div>
          </div>
        )}

        {state === 'done' && payload && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center py-2"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-success/25 bg-success/10 text-success">
              <CheckIcon className="h-5 w-5" />
            </div>
            <h1 className="mt-4 text-18 font-semibold text-ink">
              {t('unsubscribe.successTitle')}
            </h1>
            <p className="mt-1.5 max-w-sm text-13 leading-relaxed text-ink-secondary">
              {t('unsubscribe.successDescription', {
                email: payload.email,
                type: typeLabel,
              })}
            </p>
            <Link to={base} className="btn-primary mt-6">
              {t('unsubscribe.backToBoard')}
            </Link>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-11 text-ink-tertiary">
        {t('unsubscribe.footerHint')}
      </p>
    </div>
  );
}
