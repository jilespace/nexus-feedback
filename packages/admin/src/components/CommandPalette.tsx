import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { apiRequest, fetchOrgProjects } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/components/Toast';
import { CategoryBadge } from '@/components/badges';
import { StatusBadge } from '@/components/StatusBadge';
import { visibleNavItems } from '@/config/navigation';
import type { FeedbackItem, OrgMemberRole, PaginatedResponse, ProjectAccessInfo } from '@/types';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowShortcuts: () => void;
}

type PaletteItem = {
  id: string;
  group: 'actions' | 'pages' | 'feedback';
  label: string;
  hint?: string;
  icon: ReactNode;
  keywords?: string;
  run: () => void;
  trailing?: ReactNode;
};

const ICONS = {
  plus: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  copy: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M6 9.5a2.5 2.5 0 0 1 3.5-.3l1.8 1.8a2.5 2.5 0 0 1-3.5 3.5l-.9-.9M10 8.5a2.5 2.5 0 0 0-3.5.3L4.7 10.6a2.5 2.5 0 0 0 3.5 3.5l.9-.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  theme: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  language: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.6 8h10.8M8 2.4c1.5 1.6 2.2 3.5 2.2 5.6S9.5 12 8 13.6C6.5 12 5.8 10.1 5.8 8S6.5 4 8 2.4Z" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  user: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.6" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.4 13c.6-2 2.3-3.2 4.6-3.2s4 1.2 4.6 3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  keyboard: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="1.8" y="4" width="12.4" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.4 6.6h.01M6.6 6.6h.01M8.8 6.6h.01M11 6.6h.01M5.4 9.4h5.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  bell: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 2a3.6 3.6 0 0 0-3.6 3.6c0 3.2-1 4.2-1.4 4.6h10c-.4-.4-1.4-1.4-1.4-4.6A3.6 3.6 0 0 0 8 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M6.6 12.4a1.5 1.5 0 0 0 2.8 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  search: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="7.2" cy="7.2" r="4.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="m10.7 10.7 2.6 2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

function boardUrlFor(slug: string): string {
  const devBoard = import.meta.env.DEV ? 'http://localhost:8082' : window.location.origin;
  return `${devBoard}/${slug}`;
}

export function CommandPalette({ open, onOpenChange, onShowShortcuts }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { member } = useAuth();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const role = (member?.role ?? 'member') as OrgMemberRole;
  const navItems = useMemo(() => visibleNavItems(role), [role]);

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchOrgProjects,
    enabled: open,
  });

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebounced(query.trim()), 220);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const { data: feedbackResults, isFetching } = useQuery({
    queryKey: ['palette-feedback', debounced],
    queryFn: () =>
      apiRequest<PaginatedResponse<FeedbackItem>>(
        `/admin/feedback?keyword=${encodeURIComponent(debounced)}&page_size=6`,
      ),
    enabled: open && debounced.length >= 2,
  });

  // Global open shortcut.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
      if (event.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setDebounced('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const close = () => onOpenChange(false);

  const copyBoardLink = async () => {
    const project = (projects as ProjectAccessInfo[] | undefined)?.[0];
    if (!project) {
      toast.show(t('palette.no_project'), 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(boardUrlFor(project.slug));
      toast.show(t('palette.copy_success'));
    } catch {
      toast.show(t('palette.copy_failed'), 'error');
    }
    close();
  };

  const actions: PaletteItem[] = useMemo(
    () => [
      {
        id: 'action-new-changelog',
        group: 'actions',
        label: t('palette.action_new_changelog'),
        hint: t('palette.action_new_changelog_hint'),
        icon: ICONS.plus,
        keywords: 'changelog release new 新建 更新 发布',
        run: () => {
          close();
          navigate('/changelog?new=1');
        },
      },
      {
        id: 'action-copy-board',
        group: 'actions',
        label: t('palette.action_copy_board'),
        hint: t('palette.action_copy_board_hint'),
        icon: ICONS.copy,
        keywords: 'copy board share link 复制 看板 链接 分享',
        run: () => void copyBoardLink(),
      },
      {
        id: 'action-invite',
        group: 'actions',
        label: t('palette.action_invite'),
        hint: t('palette.action_invite_hint'),
        icon: ICONS.user,
        keywords: 'invite member team 邀请 成员',
        run: () => {
          close();
          navigate('/members?invite=1');
        },
      },
      {
        id: 'action-notifications',
        group: 'actions',
        label: t('palette.action_notifications'),
        hint: t('palette.action_notifications_hint'),
        icon: ICONS.bell,
        keywords: 'notification inbox bell 通知 消息 未读',
        run: () => {
          close();
          navigate('/notifications');
        },
      },
      {
        id: 'action-theme',
        group: 'actions',
        label: theme === 'dark' ? t('palette.action_theme_light') : t('palette.action_theme_dark'),
        icon: ICONS.theme,
        keywords: 'theme dark light 主题 暗色 亮色',
        run: () => {
          toggleTheme();
          close();
        },
      },
      {
        id: 'action-language',
        group: 'actions',
        label: i18n.language === 'zh' ? t('palette.action_language_to_en') : t('palette.action_language_to_zh'),
        icon: ICONS.language,
        keywords: 'language english chinese 语言 中英文',
        run: () => {
          const next = i18n.language === 'zh' ? 'en' : 'zh';
          i18n.changeLanguage(next);
          localStorage.setItem('lang', next);
          close();
        },
      },
      {
        id: 'action-shortcuts',
        group: 'actions',
        label: t('palette.action_shortcuts'),
        hint: t('palette.action_shortcuts_hint'),
        icon: ICONS.keyboard,
        keywords: 'keyboard shortcuts help 快捷键 帮助',
        run: () => {
          close();
          onShowShortcuts();
        },
      },
    ],
    [theme, i18n.language, projects],
  );

  const normalized = debounced.toLowerCase();
  const matches = (item: PaletteItem) =>
    !normalized ||
    item.label.toLowerCase().includes(normalized) ||
    (item.hint ?? '').toLowerCase().includes(normalized) ||
    (item.keywords ?? '').toLowerCase().includes(normalized);

  const pageItems: PaletteItem[] = navItems.map((item) => ({
    id: `nav-${item.to}`,
    group: 'pages',
    label: t(item.labelKey),
    hint: item.to,
    icon: <item.icon />,
    keywords: item.keywords,
    run: () => {
      close();
      navigate(item.to);
    },
  }));

  const feedbackItems: PaletteItem[] = (feedbackResults?.items ?? []).map((feedback) => ({
    id: `feedback-${feedback.id}`,
    group: 'feedback',
    label: feedback.title,
    icon: ICONS.search,
    keywords: feedback.title,
    trailing: (
      <span className="flex shrink-0 items-center gap-1.5">
        <CategoryBadge category={feedback.category} />
        <StatusBadge status={feedback.status} />
      </span>
    ),
    run: () => {
      close();
      navigate(`/feedback/${feedback.id}`);
    },
  }));

  const groups: Array<{ key: PaletteItem['group']; title: string; items: PaletteItem[] }> = [
    { key: 'actions', title: t('palette.group_actions'), items: actions.filter(matches) },
    { key: 'pages', title: t('palette.group_pages'), items: pageItems.filter(matches) },
    {
      key: 'feedback',
      title: isFetching ? t('palette.group_feedback_loading') : debounced.length >= 2 ? t('palette.group_feedback') : t('palette.group_feedback_search'),
      items: feedbackItems,
    },
  ].filter((group) => group.items.length > 0) as Array<{
    key: PaletteItem['group'];
    title: string;
    items: PaletteItem[];
  }>;

  const flat = groups.flatMap((group) => group.items);

  useEffect(() => {
    if (active >= flat.length) setActive(0);
  }, [flat.length, active]);

  useEffect(() => {
    document.getElementById(`cmd-item-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const runAt = (index: number) => {
    flat[index]?.run();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 animate-fade-in bg-gray-950/45 backdrop-blur-[2px]" onClick={close} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('palette.aria_label')}
        className="relative z-10 w-full max-w-xl animate-scale-in overflow-hidden rounded-2xl border border-surface-3 bg-surface-0 shadow-pop dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="flex items-center gap-2.5 border-b border-surface-2 px-4 dark:border-gray-700/60">
          <span className="text-gray-400 dark:text-gray-500">{ICONS.search}</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((prev) => Math.min(prev + 1, flat.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((prev) => Math.max(prev - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                runAt(active);
              }
            }}
            placeholder={t('palette.placeholder')}
            className="h-12 flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-gray-100"
          />
          <kbd className="hidden rounded border border-surface-3 bg-surface-1 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-500 sm:block">
            ESC
          </kbd>
        </div>

        <div className="max-h-[56vh] overflow-y-auto py-2">
          {flat.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-gray-400 dark:text-gray-500">
              {t('palette.empty')}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.key} className="mb-1">
                <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                  {group.title}
                </p>
                {group.items.map((item) => {
                  const index = flat.indexOf(item);
                  const isActive = index === active;
                  return (
                    <button
                      key={item.id}
                      id={`cmd-item-${index}`}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => runAt(index)}
                      className={clsx(
                        'flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors',
                        isActive
                          ? 'bg-brand-50 text-brand-800 dark:bg-brand-600/15 dark:text-brand-200'
                          : 'text-gray-700 hover:bg-surface-1 dark:text-gray-300 dark:hover:bg-gray-700/40',
                      )}
                    >
                      <span
                        className={clsx(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                          isActive
                            ? 'bg-brand-100 text-brand-600 dark:bg-brand-600/25 dark:text-brand-300'
                            : 'bg-surface-2 text-gray-400 dark:bg-gray-700/60 dark:text-gray-500',
                        )}
                      >
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{item.label}</span>
                        {item.hint && (
                          <span className="mt-0.5 block truncate text-[11px] text-gray-400 dark:text-gray-500">
                            {item.hint}
                          </span>
                        )}
                      </span>
                      {item.trailing}
                      {isActive && (
                        <kbd className="ml-1 shrink-0 rounded border border-brand-200 bg-surface-0 px-1 text-[10px] font-semibold text-brand-500 dark:border-brand-500/30 dark:bg-gray-800 dark:text-brand-300">
                          ↵
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-surface-2 px-4 py-2 text-[10px] text-gray-400 dark:border-gray-700/60 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-surface-3 px-1 dark:border-gray-600">↑</kbd>
            <kbd className="rounded border border-surface-3 px-1 dark:border-gray-600">↓</kbd>
            {t('palette.hint_select')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-surface-3 px-1 dark:border-gray-600">↵</kbd>
            {t('palette.hint_open')}
          </span>
          <span className="ml-auto">{t('palette.hint_shortcut')}</span>
        </div>
      </div>
    </div>
  );
}
