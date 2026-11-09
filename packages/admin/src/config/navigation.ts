import {
  AuditLogsIcon,
  AppsIcon,
  ChangelogNavIcon,
  DashboardIcon,
  FeedbackIcon,
  MembersIcon,
  SettingsIcon,
  SystemConfigIcon,
  TagsIcon,
} from '@/components/icons';
import type { OrgMemberRole } from '@/types';

const ALL_ROLES: OrgMemberRole[] = ['owner', 'admin', 'member'];
const ADMIN_ROLES: OrgMemberRole[] = ['owner', 'admin'];
const OWNER_ROLES: OrgMemberRole[] = ['owner'];

export type NavItem = {
  to: string;
  labelKey: string;
  icon: typeof DashboardIcon;
  roles: OrgMemberRole[];
  keywords?: string;
};

export const NAV_GROUPS: Array<{ labelKey: string; items: NavItem[] }> = [
  {
    labelKey: 'nav.group_workspace',
    items: [
      { to: '/dashboard', labelKey: 'nav.dashboard', icon: DashboardIcon, roles: ALL_ROLES, keywords: 'overview home 概览 首页 仪表盘' },
      { to: '/feedback', labelKey: 'nav.feedback', icon: FeedbackIcon, roles: ALL_ROLES, keywords: 'feedback list 反馈 列表' },
    ],
  },
  {
    labelKey: 'nav.group_content',
    items: [
      { to: '/changelog', labelKey: 'nav.changelog', icon: ChangelogNavIcon, roles: ALL_ROLES, keywords: 'changelog release 更新日志 发布' },
      { to: '/applications', labelKey: 'nav.applications', icon: AppsIcon, roles: ADMIN_ROLES, keywords: 'project api key 项目 接入 key' },
    ],
  },
  {
    labelKey: 'nav.group_team',
    items: [
      { to: '/members', labelKey: 'nav.members', icon: MembersIcon, roles: ADMIN_ROLES, keywords: 'member team invite 成员 邀请 团队' },
      { to: '/tags', labelKey: 'nav.tags', icon: TagsIcon, roles: ADMIN_ROLES, keywords: 'tag label 标签' },
      { to: '/audit-logs', labelKey: 'nav.auditLogs', icon: AuditLogsIcon, roles: ADMIN_ROLES, keywords: 'audit log 审计 日志 操作' },
    ],
  },
  {
    labelKey: 'nav.group_settings',
    items: [
      { to: '/system-config', labelKey: 'nav.systemConfig', icon: SystemConfigIcon, roles: OWNER_ROLES, keywords: 'email storage config 系统配置 邮件 存储' },
      { to: '/settings', labelKey: 'nav.settings', icon: SettingsIcon, roles: OWNER_ROLES, keywords: 'org settings password 组织设置 密码' },
    ],
  },
];

const PAGE_TITLE_KEYS: Record<string, string> = {
  '/dashboard': 'nav.dashboard',
  '/feedback': 'nav.feedback',
  '/changelog': 'nav.changelog',
  '/applications': 'nav.applications',
  '/members': 'nav.members',
  '/tags': 'nav.tags',
  '/audit-logs': 'nav.auditLogs',
  '/system-config': 'nav.systemConfig',
  '/settings': 'nav.settings',
};

export function matchPageKey(pathname: string): string | null {
  if (pathname.startsWith('/feedback/')) return 'nav.feedback';
  if (pathname.startsWith('/projects/')) return 'nav.applications';
  return PAGE_TITLE_KEYS[pathname] ?? null;
}

export function visibleNavItems(role: OrgMemberRole): NavItem[] {
  return NAV_GROUPS.flatMap((group) =>
    group.items.filter((item) => item.roles.includes(role)),
  );
}
