import { Suspense, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ShortcutHelp } from '@/components/ShortcutHelp';
import { CommandPalette } from '@/components/CommandPalette';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageFallback } from '@/components/PageFallback';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { NAV_GROUPS, matchPageKey } from '@/config/navigation';
import {
  LogoutIcon,
  SunIcon,
  MoonIcon,
  MenuIcon,
  CloseIcon,
  HelpIcon,
  SearchIcon,
} from '@/components/icons';
import type { OrgMemberRole } from '@/types';

export function Layout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { logout, member, organization } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showHelp, setShowHelp } = useKeyboardShortcuts();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();

  const toggleLang = () => {
    const next = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(next);
    localStorage.setItem('lang', next);
  };

  const displayName = member?.display_name || member?.email?.split('@')[0] || '用户';
  const ROLE_LABELS: Record<string, string> = { owner: '所有者', admin: '管理员', member: '成员' };
  const roleBadge = ROLE_LABELS[member?.role ?? 'member'] ?? '成员';
  const orgName = organization?.name || 'Nexus';
  const memberRole = (member?.role ?? 'member') as OrgMemberRole;
  const pageKey = matchPageKey(location.pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-1 dark:bg-gray-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 animate-fade-in bg-gray-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-surface-3 bg-surface-0',
          'dark:border-gray-700/80 dark:bg-gray-800',
          'transition-transform duration-300 ease-out lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 shadow-sm">
              <span className="text-[13px] font-bold leading-none text-white">
                {orgName.slice(0, 1).toUpperCase()}
              </span>
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100">
                {orgName}
              </span>
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                Nexus Feedback
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-surface-2 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 lg:hidden"
            aria-label="关闭导航"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Command palette trigger */}
        <div className="px-3 pb-2">
          <button
            onClick={() => setPaletteOpen(true)}
            className="group flex w-full items-center gap-2 rounded-lg border border-surface-3 bg-surface-1/60 px-2.5 py-2 text-left text-xs text-gray-400 transition-colors hover:border-gray-300 hover:bg-surface-2 hover:text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-500 dark:hover:border-gray-600 dark:hover:text-gray-300"
          >
            <SearchIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 truncate">搜索、跳转或执行操作…</span>
            <kbd className="shrink-0 rounded border border-surface-3 bg-surface-0 px-1 py-0.5 font-sans text-[10px] font-semibold text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => item.roles.includes(memberRole));
            if (!items.length) return null;
            return (
              <div key={group.labelKey} className="mb-5 last:mb-0">
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400/90 dark:text-gray-500">
                  {t(group.labelKey)}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/dashboard'}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        clsx(
                          'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-150',
                          isActive
                            ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300'
                            : 'text-gray-600 hover:bg-surface-2 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/60 dark:hover:text-gray-100',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={clsx(
                              'absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full transition-opacity',
                              isActive ? 'bg-brand-600 opacity-100' : 'opacity-0',
                            )}
                          />
                          <item.icon active={isActive} className="h-[17px] w-[17px]" />
                          <span className="truncate">{t(item.labelKey)}</span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-surface-3 p-3 dark:border-gray-700/80">
          <button
            onClick={() => setShowHelp(true)}
            className="mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-gray-500 transition-colors hover:bg-surface-2 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/60 dark:hover:text-gray-200"
          >
            <HelpIcon />
            <span className="flex-1">{t('nav.shortcuts')}</span>
            <kbd className="rounded border border-surface-3 bg-surface-1 px-1 text-[10px] font-semibold text-gray-400 dark:border-gray-700 dark:bg-gray-700/60 dark:text-gray-500">
              ?
            </kbd>
          </button>

          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200 text-xs font-semibold text-gray-600 ring-1 ring-surface-3 dark:from-gray-700 dark:to-gray-700/60 dark:text-gray-200 dark:ring-gray-600/60">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium leading-tight text-gray-900 dark:text-gray-100">
                {displayName}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-gray-400 dark:text-gray-500">
                {roleBadge}
              </p>
            </div>
            <button
              onClick={toggleLang}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-gray-400 transition-colors hover:bg-surface-2 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              title={i18n.language === 'zh' ? 'English' : '中文'}
              aria-label="切换语言"
            >
              {i18n.language === 'zh' ? 'EN' : '中'}
            </button>
            <button
              onClick={toggleTheme}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-surface-2 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              title={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
              aria-label="切换主题"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
          <button
            onClick={logout}
            className="mt-0.5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-gray-500 transition-colors hover:bg-surface-2 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/60 dark:hover:text-gray-200"
          >
            <LogoutIcon />
            {t('common.logout')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-surface-3 bg-surface-0 px-4 dark:border-gray-700/80 dark:bg-gray-800 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-surface-2 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
            aria-label="打开导航"
          >
            <MenuIcon />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-brand-700">
              <span className="text-[10px] font-bold text-white">
                {orgName.slice(0, 1).toUpperCase()}
              </span>
            </div>
            <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {pageKey ? t(pageKey) : orgName}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-surface-2 dark:text-gray-400 dark:hover:bg-gray-700"
              aria-label="搜索与快捷操作"
            >
              <SearchIcon className="h-4 w-4" />
            </button>
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-surface-2 dark:text-gray-400 dark:hover:bg-gray-700"
              aria-label="切换主题"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:p-8">
            <ErrorBoundary>
              <Suspense fallback={<PageFallback />}>{children}</Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {showHelp && <ShortcutHelp onClose={() => setShowHelp(false)} />}

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onShowShortcuts={() => setShowHelp(true)}
      />
    </div>
  );
}
