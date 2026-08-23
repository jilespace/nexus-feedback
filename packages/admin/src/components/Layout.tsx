import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ShortcutHelp } from '@/components/ShortcutHelp';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import {
  DashboardIcon, FeedbackIcon, ChangelogNavIcon, AppsIcon,
  MembersIcon, TagsIcon, SystemConfigIcon, SettingsIcon,
  LogoutIcon, SunIcon, MoonIcon, MenuIcon, CloseIcon,
  AuditLogsIcon,
} from '@/components/icons';

import type { OrgMemberRole } from '@/types';

const ALL_ROLES: OrgMemberRole[] = ['owner', 'admin', 'member'];
const ADMIN_ROLES: OrgMemberRole[] = ['owner', 'admin'];
const OWNER_ROLES: OrgMemberRole[] = ['owner'];

const navItems = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: DashboardIcon, roles: ALL_ROLES },
  { to: '/feedback', labelKey: 'nav.feedback', icon: FeedbackIcon, roles: ALL_ROLES },
  { to: '/changelog', labelKey: 'nav.changelog', icon: ChangelogNavIcon, roles: ALL_ROLES },
  { to: '/applications', labelKey: 'nav.applications', icon: AppsIcon, roles: ADMIN_ROLES },
  { to: '/members', labelKey: 'nav.members', icon: MembersIcon, roles: ADMIN_ROLES },
  { to: '/tags', labelKey: 'nav.tags', icon: TagsIcon, roles: ADMIN_ROLES },
  { to: '/audit-logs', labelKey: 'nav.auditLogs', icon: AuditLogsIcon, roles: ADMIN_ROLES },
  { to: '/system-config', labelKey: 'nav.systemConfig', icon: SystemConfigIcon, roles: OWNER_ROLES },
  { to: '/settings', labelKey: 'nav.settings', icon: SettingsIcon, roles: OWNER_ROLES },
];

export function Layout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { logout, member, organization } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showHelp, setShowHelp } = useKeyboardShortcuts();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleLang = () => {
    const next = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(next);
    localStorage.setItem('lang', next);
  };

  const displayName = member?.display_name ?? '用户';
  const ROLE_LABELS: Record<string, string> = { owner: '所有者', admin: '管理员', member: '成员' };
  const roleBadge = ROLE_LABELS[member?.role ?? 'member'] ?? '成员';
  const orgName = organization?.name ?? 'Nexus';
  const memberRole = (member?.role ?? 'member') as OrgMemberRole;
  const visibleNavItems = navItems.filter((item) => item.roles.includes(memberRole));

  return (
    <div className="flex h-screen overflow-hidden bg-surface-1 dark:bg-gray-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-surface-3 bg-surface-0 transition-transform duration-300 ease-in-out',
          'dark:border-gray-700 dark:bg-gray-800',
          'lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between gap-2.5 px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600">
              <span className="text-xs font-bold text-white">{orgName[0]}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{orgName}</span>
              <span className="text-[10px] font-medium leading-none text-gray-400 dark:text-gray-500">Feedback</span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-2 hover:text-gray-600 lg:hidden"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                    : 'text-gray-600 hover:bg-surface-2 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-600" />
                  )}
                  <item.icon active={isActive} />
                  {t(item.labelKey)}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-surface-3 p-3 dark:border-gray-700">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              {displayName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</p>
              <p className="truncate text-xs text-gray-400 dark:text-gray-500">{roleBadge}</p>
            </div>
            <button
              onClick={toggleLang}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-gray-400 transition-colors hover:bg-surface-2 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              title={i18n.language === 'zh' ? 'English' : '中文'}
            >
              {i18n.language === 'zh' ? 'EN' : '中'}
            </button>
            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-surface-2 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              title={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
          <button
            onClick={logout}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-500 transition-colors hover:bg-surface-2 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            <LogoutIcon />
            {t('common.logout')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-14 items-center gap-3 border-b border-surface-3 bg-surface-0 px-4 dark:border-gray-700 dark:bg-gray-800 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-surface-2 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <MenuIcon />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-brand-600">
              <span className="text-[10px] font-bold text-white">{orgName[0]}</span>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{orgName}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>

      {showHelp && <ShortcutHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}
