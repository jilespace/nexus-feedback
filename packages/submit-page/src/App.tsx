import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, resolveBoardUrl, validateAccess, type ProjectIdentity } from './lib/api';
import { AccessGate } from './components/AccessGate';
import { BrandPanel } from './components/BrandPanel';
import { ChatMarkIcon, LockIcon } from './components/Icons';
import { SubmitForm } from './components/SubmitForm';

type AccessState =
  | { status: 'checking' }
  | { status: 'missing' }
  | { status: 'invalid'; message: string; rateLimited: boolean }
  | { status: 'valid'; project: ProjectIdentity };

const API_URL = '/api/v1';

export function App() {
  const apiKey = useMemo(() => new URLSearchParams(window.location.search).get('key')?.trim() ?? '', []);
  const [attempt, setAttempt] = useState(0);
  const [access, setAccess] = useState<AccessState>({ status: apiKey ? 'checking' : 'missing' });

  const retryAccess = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!apiKey) {
      setAccess({ status: 'missing' });
      return;
    }

    const controller = new AbortController();
    setAccess({ status: 'checking' });

    validateAccess(API_URL, apiKey, controller.signal)
      .then((project) => {
        if (!controller.signal.aborted) setAccess({ status: 'valid', project });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const apiError = err instanceof ApiError ? err : null;
        setAccess({
          status: 'invalid',
          message: apiError?.message ?? '暂时无法校验链接，请稍后重试。',
          rateLimited: apiError?.status === 429,
        });
      });

    return () => controller.abort();
  }, [apiKey, attempt]);

  const project = access.status === 'valid' ? access.project : undefined;
  const boardUrl = project ? resolveBoardUrl(project.slug) : undefined;

  useEffect(() => {
    document.title = project ? `提交反馈 · ${project.name}` : '提交反馈 · Nexus Feedback';
  }, [project]);

  return (
    <div className="relative flex min-h-screen flex-col bg-canvas">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(120%_100%_at_50%_0%,#ffffff_0%,rgb(246_247_249_/_0)_72%)]"
        aria-hidden
      />

      <a
        href="#feedback-form"
        className="sr-only z-50 rounded-field bg-brand-600 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        跳到反馈表单
      </a>

      <header className="relative z-10 border-b border-line bg-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between gap-4 px-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_4px_12px_-4px_rgb(61_90_254_/_0.6)]">
              <ChatMarkIcon className="h-4 w-4" />
            </span>
            <span className="truncate text-[14px] font-semibold tracking-[-0.01em] text-ink-1">Nexus Feedback</span>
            <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
            <span className="hidden whitespace-nowrap text-[12px] text-ink-3 sm:block">公开反馈通道</span>
          </div>

          <div className="flex flex-shrink-0 items-center gap-3">
            {boardUrl && (
              <a
                href={boardUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden items-center gap-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:text-brand-600 sm:inline-flex"
              >
                公开看板
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5" aria-hidden>
                  <path d="M7 17L17 7M8 7h9v9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-3">
              <LockIcon className="h-3 w-3" />
              私密链接
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex w-full flex-1 items-start justify-center px-5 py-8 sm:px-6 lg:py-14">
        <div className="grid w-full max-w-[1120px] grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-14">
          <BrandPanel projectName={project?.name} boardUrl={boardUrl} />

          <div
            id="feedback-form"
            className={`min-w-0 scroll-mt-24 ${
              // Reserve the form's typical height while the access check runs so the
              // footer does not jump when the skeleton is replaced by the real form.
              access.status === 'checking' ? 'lg:min-h-[1056px]' : ''
            }`}
          >
            {access.status === 'valid' && project ? (
              <SubmitForm
                apiUrl={API_URL}
                apiKey={apiKey}
                projectSlug={project.slug}
                projectName={project.name}
                boardUrl={boardUrl}
              />
            ) : (
              <AccessGate
                status={access.status === 'valid' ? 'checking' : access.status}
                message={access.status === 'invalid' ? access.message : undefined}
                rateLimited={access.status === 'invalid' ? access.rateLimited : false}
                onRetry={access.status === 'invalid' ? retryAccess : undefined}
              />
            )}
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center justify-between gap-2 px-5 py-5 sm:flex-row sm:px-6">
          <p className="text-[11.5px] text-ink-3">
            由 <span className="font-semibold text-ink-2">Nexus Feedback</span> 提供反馈收集能力
          </p>
          <p className="text-[11.5px] text-ink-3">你的反馈会帮助产品变得更好</p>
        </div>
      </footer>
    </div>
  );
}
