import { Routes, Route, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BoardHome } from './pages/BoardHome';
import { FeedbackDetail } from './pages/FeedbackDetail';
import { Roadmap } from './pages/Roadmap';
import { Changelog } from './pages/Changelog';
import type { ReactNode } from 'react';

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-5xl font-bold text-gray-300">404</p>
      <p className="mt-4 text-lg text-gray-500">页面不存在</p>
    </div>
  );
}

function NavTab({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `rounded-md px-3 py-1.5 text-sm font-medium transition ${
          isActive
            ? 'bg-brand-50 text-brand-600'
            : 'text-gray-500 hover:text-gray-700'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/:projectSlug/*" element={<BoardLayout />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function BoardLayout() {
  const { t, i18n } = useTranslation();

  const toggleLang = () => {
    const next = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(next);
    localStorage.setItem('lang', next);
  };

  return (
    <div className="min-h-screen bg-surface-1">
      <header className="sticky top-0 z-40 border-b border-surface-3 bg-surface-0/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3">
          <h1 className="mr-8 text-base font-semibold text-gray-900">
            Feedback
          </h1>
          <nav className="flex flex-1 gap-1">
            <NavTab to=".">{t('nav.feedback')}</NavTab>
            <NavTab to="roadmap">{t('nav.roadmap')}</NavTab>
            <NavTab to="changelog">{t('nav.changelog')}</NavTab>
          </nav>
          <button
            onClick={toggleLang}
            className="rounded-md px-2 py-1 text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            {i18n.language === 'zh' ? 'EN' : '中'}
          </button>
        </div>
      </header>
      <main>
        <Routes>
          <Route index element={<BoardHome />} />
          <Route path="feedback/:id" element={<FeedbackDetail />} />
          <Route path="roadmap" element={<Roadmap />} />
          <Route path="changelog" element={<Changelog />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
