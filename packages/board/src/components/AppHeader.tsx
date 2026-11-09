import { Link, NavLink, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/theme';
import {
  ArrowUpIcon,
  GlobeIcon,
  LayersIcon,
  MessageIcon,
  MoonIcon,
  SparkIcon,
  SunIcon,
} from './Icons';

const NAV_ITEMS = [
  { key: 'feedback', path: '', labelKey: 'nav.feedback', Icon: MessageIcon },
  { key: 'roadmap', path: 'roadmap', labelKey: 'nav.roadmap', Icon: LayersIcon },
  {
    key: 'changelog',
    path: 'changelog',
    labelKey: 'nav.changelog',
    Icon: SparkIcon,
  },
];

interface AppHeaderProps {
  projectName: string;
  orgName?: string;
}

function navLinkClass(isActive: boolean): string {
  return `inline-flex shrink-0 items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-12 font-medium transition-colors duration-150 ${
    isActive
      ? 'bg-brand-soft text-brand'
      : 'text-ink-secondary hover:bg-surface hover:text-ink'
  }`;
}

export function AppHeader({ projectName, orgName }: AppHeaderProps) {
  const { t, i18n } = useTranslation();
  const { projectSlug } = useParams<{ projectSlug: string }>();
  const { theme, toggleTheme } = useTheme();
  const base = `/${projectSlug ?? ''}`;
  const isZh = i18n.language.startsWith('zh');

  function toggleLanguage() {
    const next = isZh ? 'en' : 'zh';
    void i18n.changeLanguage(next);
    try {
      localStorage.setItem('lang', next);
    } catch {
      /* ignore */
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line-subtle bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex h-14 items-center gap-3">
          <Link
            to={base}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control md:flex-none"
            aria-label={t('nav.home')}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand text-white shadow-card">
              <ArrowUpIcon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-14 font-semibold leading-tight text-ink">
                {projectName}
              </span>
              <span className="block truncate text-11 leading-tight text-ink-tertiary">
                {orgName
                  ? `${orgName} · ${t('nav.boardSubtitle')}`
                  : t('nav.boardSubtitle')}
              </span>
            </span>
          </Link>

          <nav
            className="hidden items-center gap-0.5 rounded-control border border-line-subtle bg-surface-subtle p-1 md:flex"
            aria-label={t('nav.mainLabel')}
          >
            {NAV_ITEMS.map(({ key, path, labelKey, Icon }) => (
              <NavLink
                key={key}
                to={`${base}${path ? `/${path}` : ''}`}
                end={path === ''}
                className={({ isActive }) => navLinkClass(isActive)}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {t(labelKey)}
              </NavLink>
            ))}
          </nav>

          <div className="hidden flex-1 md:block" />

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={toggleTheme}
              className="icon-btn"
              aria-label={t('common.toggleTheme')}
              title={t('common.toggleTheme')}
            >
              {theme === 'dark' ? (
                <SunIcon className="h-4 w-4" />
              ) : (
                <MoonIcon className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={toggleLanguage}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control border border-line-subtle bg-surface px-2.5 text-12 font-medium text-ink-secondary transition-colors duration-150 hover:border-line-strong hover:text-ink"
              aria-label={t('common.switchLanguage')}
              title={t('common.switchLanguage')}
            >
              <GlobeIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isZh ? '中文' : 'EN'}</span>
            </button>
          </div>
        </div>

        <nav
          className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 pb-2 md:hidden"
          aria-label={t('nav.mainLabel')}
        >
          {NAV_ITEMS.map(({ key, path, labelKey, Icon }) => (
            <NavLink
              key={key}
              to={`${base}${path ? `/${path}` : ''}`}
              end={path === ''}
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
