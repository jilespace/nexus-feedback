import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchBoardConfig } from './api';
import type { BoardConfig } from './types';
import { AppHeader } from './components/AppHeader';
import { SubscribeCard } from './components/SubscribeCard';
import { BoardHome } from './pages/BoardHome';
import { FeedbackDetail } from './pages/FeedbackDetail';
import { Roadmap } from './pages/Roadmap';
import { Changelog } from './pages/Changelog';
import { Unsubscribe } from './pages/Unsubscribe';

function NotFoundPage({ showReturn = true }: { showReturn?: boolean }) {
  const { t } = useTranslation();
  const { projectSlug } = useParams<{ projectSlug?: string }>();
  const base = `/${projectSlug ?? ''}`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center">
      <p className="tnum text-34 font-semibold text-ink-tertiary">404</p>
      <h1 className="mt-2 text-22 font-semibold text-ink">
        {t('notFound.title')}
      </h1>
      <p className="mt-1.5 max-w-sm text-13 text-ink-secondary">
        {t('notFound.description')}
      </p>
      {showReturn && (
        <Link to={base} className="btn-primary mt-6">
          {t('notFound.action')}
        </Link>
      )}
    </div>
  );
}

function RootNotFound() {
  return (
    <div className="min-h-screen bg-canvas">
      <NotFoundPage showReturn={false} />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/:projectSlug/*" element={<BoardLayout />} />
      <Route path="*" element={<RootNotFound />} />
    </Routes>
  );
}

function BoardLayout() {
  const { t, i18n } = useTranslation();
  const { projectSlug } = useParams<{ projectSlug: string }>();
  const location = useLocation();
  const [config, setConfig] = useState<BoardConfig | null>(null);

  useEffect(() => {
    let active = true;
    void fetchBoardConfig()
      .then((next) => {
        if (active) setConfig(next);
      })
      .catch(() => {
        /* header falls back to slug */
      });
    return () => {
      active = false;
    };
  }, [projectSlug]);

  const projectName = config?.project.name || projectSlug || 'Nexus Feedback';
  const orgName = config?.organization?.name ?? undefined;

  useEffect(() => {
    document.documentElement.lang = i18n.language.startsWith('zh')
      ? 'zh-CN'
      : 'en';
  }, [i18n.language]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-control focus:border focus:border-line-subtle focus:bg-surface focus:px-3 focus:py-2 focus:text-13 focus:text-ink focus:shadow-pop"
      >
        {t('common.skipToContent')}
      </a>
      <AppHeader projectName={projectName} orgName={orgName} />
      <main id="main-content" className="flex-1">
        <Routes>
          <Route index element={<BoardHome projectName={projectName} />} />
          <Route
            path="feedback/:id"
            element={<FeedbackDetail projectName={projectName} />}
          />
          <Route path="roadmap" element={<Roadmap projectName={projectName} />} />
          <Route
            path="changelog"
            element={<Changelog projectName={projectName} />}
          />
          <Route
            path="unsubscribe"
            element={<Unsubscribe projectName={projectName} />}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer className="border-t border-line-subtle">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <SubscribeCard />
          <div className="mt-6 flex flex-col gap-1 border-t border-line-subtle pt-6 text-11 text-ink-tertiary sm:flex-row sm:items-center sm:justify-between">
            <p>
              {t('common.copyright', {
                year: new Date().getFullYear(),
                name: orgName || projectName,
              })}
            </p>
            <p>{t('common.poweredBy')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
