import { useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '@fontsource-variable/instrument-sans/wght.css';
import '@/styles/landing.css';

const GITHUB_URL = 'https://github.com/nexus-feedback/nexus-feedback';
const BRAND_NAME = 'Nexus Feedback';
const BRAND_SUB = 'Feedback OS';

type Tone = 'info' | 'amber' | 'success';

type StatusRow = {
  title: string;
  source: string;
  votes: number;
  status: string;
  tone: Tone;
  dot: string;
};

type LandingCopy = {
  langToggleLabel: string;
  langToggleAria: string;
  skipLink: string;
  nav: {
    links: Array<{ href: string; label: string }>;
    github: string;
    cta: string;
    homeAria: string;
    navAria: string;
  };
  hero: {
    badge: string;
    titleA: string;
    titleB: string;
    lede: string;
    ctaPrimary: string;
    ctaSecondary: string;
    proofStrong: string;
    proofText: string;
    proofInitials: string[];
  };
  mock: {
    aria: string;
    url: string;
    sidebarName: string;
    sidebarNav: string[];
    userName: string;
    userRole: string;
    newProject: string;
    pageTitle: string;
    pageSub: string;
    chartTitle: string;
    legendNew: string;
    legendSolved: string;
    kpis: Array<{ label: string; value: string; tone: 'brand' | 'amber' | 'success' | '' }>;
    rows: StatusRow[];
    floatInbox: { label: string; title: string; votes: string; status: string };
    floatStat: { label: string; value: string; delta: string };
  };
  metricsAria: string;
  metrics: Array<{ value: string; label: string; note: string }>;
  trust: string[];
  capabilities: {
    kicker: string;
    title: string;
    desc: string;
    link: string;
    inbox: {
      title: string;
      desc: string;
      rows: StatusRow[];
      footPrefix: string;
      footCount: string;
      footSuffix: string;
      footAction: string;
    };
    insight: {
      title: string;
      desc: string;
      label: string;
      value: string;
      delta: string;
      distTitle: string;
      dist: Array<{ label: string; pct: number; color: string }>;
    };
    collab: {
      title: string;
      desc: string;
      rows: Array<{ initial: string; name: string; role: string; note: string; color: string }>;
    };
    security: { title: string; desc: string; comment: string; tags: string[] };
  };
  workflow: {
    kicker: string;
    title: string;
    desc: string;
    steps: Array<{ no: string; title: string; desc: string; meta: string }>;
    foot: string;
    link: string;
  };
  cta: { kicker: string; title: string; desc: string; primary: string; secondary: string; note: string };
  footer: {
    brandDesc: string;
    status: string;
    columns: Array<{ title: string; links: Array<{ label: string; href: string }> }>;
    copyright: string;
    tags: string[];
  };
};

const DOT = {
  info: 'var(--lp-info)',
  amber: 'var(--lp-amber)',
  success: 'var(--lp-success)',
  violet: 'var(--lp-violet)',
} as const;

const ZH_COPY: LandingCopy = {
  langToggleLabel: 'EN',
  langToggleAria: '切换到英文',
  skipLink: '跳到主要内容',
  nav: {
    links: [
      { href: '#capabilities', label: '核心能力' },
      { href: '#workflow', label: '使用流程' },
      { href: '#start', label: '开始使用' },
    ],
    github: 'GitHub',
    cta: '进入控制台',
    homeAria: 'Nexus Feedback 首页',
    navAria: '页面导航',
  },
  hero: {
    badge: '开源 · 可自托管 · v2.0',
    titleA: '倾听用户声音',
    titleB: '驱动产品进化',
    lede: '把 Widget、提交页和公开看板的反馈收进一条收件箱：分类、投票、指派与状态流转，让每一条建议都被看见、被回应。',
    ctaPrimary: '免费开始使用',
    ctaSecondary: '查看源代码',
    proofStrong: '50+ 团队',
    proofText: '正在用它收集产品反馈',
    proofInitials: ['林', '陈', '周', '赵'],
  },
  mock: {
    aria: 'Nexus Feedback 控制台预览：反馈概览、趋势图与最新反馈列表',
    url: 'app.nexus-feedback.dev/dashboard',
    sidebarName: 'Nexus',
    sidebarNav: ['概览', '反馈列表', '更新日志', '团队成员', '标签管理'],
    userName: 'admin',
    userRole: '所有者',
    newProject: '新建项目',
    pageTitle: '概览',
    pageSub: '近 30 天 · Demo 工作区',
    chartTitle: '反馈趋势',
    legendNew: '新增',
    legendSolved: '已解决',
    kpis: [
      { label: '总反馈', value: '2,847', tone: 'brand' },
      { label: '待处理', value: '128', tone: 'amber' },
      { label: '已解决', value: '2,103', tone: 'success' },
      { label: '平均响应', value: '4.2h', tone: '' },
    ],
    rows: [
      { title: '希望支持深色模式', source: 'Widget', votes: 234, status: '处理中', tone: 'info', dot: DOT.info },
      { title: '导出功能需要支持 CSV', source: '提交页', votes: 189, status: '待处理', tone: 'amber', dot: DOT.amber },
      { title: '移动端筛选器遮挡列表', source: '看板', votes: 156, status: '已解决', tone: 'success', dot: DOT.success },
    ],
    floatInbox: { label: '新反馈 · Widget', title: '希望支持深色模式', votes: '▲ 234 票', status: '处理中' },
    floatStat: { label: '首次响应', value: '1.8h', delta: '↓ 32% 较上周' },
  },
  metricsAria: '产品数据',
  metrics: [
    { value: '10K+', label: '已收集反馈', note: '覆盖 Widget、提交页与公开看板' },
    { value: '99.9%', label: '运行稳定性', note: '近 12 个月平均可用性' },
    { value: '<2h', label: '平均首次响应', note: '接入团队协作后的响应中位数' },
    { value: '50+', label: '团队正在使用', note: '从初创团队到企业客户' },
  ],
  trust: ['MIT 开源许可', '完全自托管部署', '数据留在自有基础设施'],
  capabilities: {
    kicker: '核心能力',
    title: '从收到，到回应，一条完整链路',
    desc: '不是又一个表单收集工具：收集、整理、排序与回应发生在同一处，每条反馈的处理过程都留痕。',
    link: '查看工作流程',
    inbox: {
      title: '统一收件箱',
      desc: 'Widget、提交页、公开看板与 API 的反馈汇入同一列表；来源、分类、状态与负责人一眼可见。',
      rows: [
        { title: '希望支持深色模式', source: 'Widget', votes: 234, status: '处理中', tone: 'info', dot: DOT.info },
        { title: '导出功能需要支持 CSV', source: '提交页', votes: 189, status: '待处理', tone: 'amber', dot: DOT.amber },
        { title: '移动端筛选器遮挡列表', source: '看板', votes: 156, status: '已解决', tone: 'success', dot: DOT.success },
        { title: 'Webhook 支持自定义重试策略', source: 'API', votes: 97, status: '处理中', tone: 'info', dot: DOT.violet },
        { title: '公开路线图支持评论', source: '看板', votes: 64, status: '待处理', tone: 'amber', dot: DOT.info },
      ],
      footPrefix: '共',
      footCount: '2,847',
      footSuffix: '条反馈',
      footAction: '查看全部 →',
    },
    insight: {
      title: '实时洞察',
      desc: '投票趋势、来源分布与首次响应时间，用同一套指标衡量团队响应的质量。',
      label: '本周新增反馈',
      value: '386',
      delta: '↑ 18.4%',
      distTitle: '来源分布',
      dist: [
        { label: 'Widget', pct: 46, color: 'var(--lp-brand)' },
        { label: '提交页', pct: 32, color: 'var(--lp-amber)' },
        { label: '公开看板', pct: 22, color: 'var(--lp-info)' },
      ],
    },
    collab: {
      title: '团队协作',
      desc: '指派负责人、追加内部备注、批量流转状态，每条反馈的处理过程都有记录。',
      rows: [
        { initial: '林', name: '林可', role: '产品 · 负责人', note: '已分派', color: '#3d5afe' },
        { initial: '陈', name: '陈默', role: '设计 · 内部备注', note: '已排期 Q4', color: '#f59e0b' },
        { initial: '周', name: '周然', role: '工程 · 状态', note: '处理中', color: '#10b981' },
      ],
    },
    security: {
      title: '开放与安全',
      desc: '一路脚本即可嵌入；Webhook HMAC 签名、多租户隔离与完整审计日志，数据始终在你手里。',
      comment: '<!-- 一行脚本接入 Widget -->',
      tags: ['自托管部署', 'Webhook HMAC', '审计日志', 'SSO 单点登录'],
    },
  },
  workflow: {
    kicker: '使用流程',
    title: '三步，把反馈变成路线图',
    desc: '接入、整理、回应：团队可以立刻开始，不需要迁移历史数据。',
    steps: [
      {
        no: '01',
        title: '嵌入收集',
        desc: '在官网或产品内嵌入一行脚本，或直接分享公开提交页与看板链接。组件自动继承你的品牌色与语言。',
        meta: '≈ 5 分钟完成接入',
      },
      {
        no: '02',
        title: '整理排序',
        desc: '按投票、分类与优先级过滤，批量合并重复建议，把用户的原话沉淀为一份可决策的清单。',
        meta: '自动去重与分类',
      },
      {
        no: '03',
        title: '回应闭环',
        desc: '状态流转、内部备注与更新日志，让提出建议的用户知道它被采纳、被排期、被解决。',
        meta: '处理过程全程可追溯',
      },
    ],
    foot: '接入只需一行脚本，无需迁移历史数据',
    link: '阅读部署文档',
  },
  cta: {
    kicker: '开始使用',
    title: '让下一条反馈，出现在你的收件箱里',
    desc: '开源免费，可自托管部署。几分钟内部署完成，数据与品牌都归你。',
    primary: '进入控制台',
    secondary: 'GitHub',
    note: 'MIT License · Docker 一键部署 · 无需信用卡',
  },
  footer: {
    brandDesc: '开源的反馈管理平台：收集、整理、回应，让用户的声音真正进入产品决策。',
    status: '开源 · 可自托管 · MIT License',
    columns: [
      {
        title: '产品',
        links: [
          { label: '核心能力', href: '#capabilities' },
          { label: '使用流程', href: '#workflow' },
          { label: '进入控制台', href: '/dashboard' },
        ],
      },
      {
        title: '资源',
        links: [
          { label: 'GitHub 仓库', href: GITHUB_URL },
          { label: '部署文档', href: GITHUB_URL },
          { label: '发布日志', href: `${GITHUB_URL}/releases` },
        ],
      },
      {
        title: '项目',
        links: [
          { label: '开源许可', href: `${GITHUB_URL}/blob/main/LICENSE` },
          { label: '问题反馈', href: `${GITHUB_URL}/issues` },
          { label: '安全说明', href: `${GITHUB_URL}/blob/main/SECURITY.md` },
        ],
      },
    ],
    copyright: '© 2026 Nexus Feedback · 开源的用户反馈管理平台',
    tags: ['v2.0.0', 'MIT License', 'Made for product teams'],
  },
};

const EN_COPY: LandingCopy = {
  langToggleLabel: 'ZH',
  langToggleAria: 'Switch to Chinese',
  skipLink: 'Skip to main content',
  nav: {
    links: [
      { href: '#capabilities', label: 'Features' },
      { href: '#workflow', label: 'How it works' },
      { href: '#start', label: 'Get started' },
    ],
    github: 'GitHub',
    cta: 'Open dashboard',
    homeAria: 'Nexus Feedback home',
    navAria: 'Page navigation',
  },
  hero: {
    badge: 'Open source · Self-hostable · v2.0',
    titleA: 'Listen to your users',
    titleB: 'Ship what matters',
    lede: 'Nexus Feedback brings the widget, submit page and public board into one inbox — classify, vote, assign and move status so every request is seen and answered.',
    ctaPrimary: 'Start for free',
    ctaSecondary: 'View source',
    proofStrong: '50+ teams',
    proofText: 'collect product feedback with it',
    proofInitials: ['L', 'C', 'Z', 'W'],
  },
  mock: {
    aria: 'Nexus Feedback dashboard preview: overview, trend chart and latest feedback',
    url: 'app.nexus-feedback.dev/dashboard',
    sidebarName: 'Nexus',
    sidebarNav: ['Overview', 'Feedback', 'Changelog', 'Team', 'Tags'],
    userName: 'admin',
    userRole: 'Owner',
    newProject: 'New project',
    pageTitle: 'Overview',
    pageSub: 'Last 30 days · Demo workspace',
    chartTitle: 'Feedback trend',
    legendNew: 'New',
    legendSolved: 'Resolved',
    kpis: [
      { label: 'Total feedback', value: '2,847', tone: 'brand' },
      { label: 'Open', value: '128', tone: 'amber' },
      { label: 'Resolved', value: '2,103', tone: 'success' },
      { label: 'Avg. response', value: '4.2h', tone: '' },
    ],
    rows: [
      { title: 'Dark mode support', source: 'Widget', votes: 234, status: 'In progress', tone: 'info', dot: DOT.info },
      { title: 'CSV export support', source: 'Submit', votes: 189, status: 'Open', tone: 'amber', dot: DOT.amber },
      { title: 'Mobile filters cover the list', source: 'Board', votes: 156, status: 'Resolved', tone: 'success', dot: DOT.success },
    ],
    floatInbox: { label: 'New feedback · Widget', title: 'Dark mode support', votes: '▲ 234 votes', status: 'In progress' },
    floatStat: { label: 'First response', value: '1.8h', delta: '↓ 32% vs last week' },
  },
  metricsAria: 'Product metrics',
  metrics: [
    { value: '10K+', label: 'Feedback collected', note: 'Across widget, submit page and public board' },
    { value: '99.9%', label: 'Uptime', note: '12-month rolling average' },
    { value: '<2h', label: 'First response', note: 'Median after team assignment' },
    { value: '50+', label: 'Teams using it', note: 'From startups to enterprise teams' },
  ],
  trust: ['MIT licensed', 'Fully self-hostable', 'Data stays on your infrastructure'],
  capabilities: {
    kicker: 'Capabilities',
    title: 'From intake to reply, one connected loop',
    desc: 'Not just another form tool: collect, triage, rank and respond in one place, with every step on the record.',
    link: 'See how it works',
    inbox: {
      title: 'One unified inbox',
      desc: 'Feedback from the widget, submit page, public board and API lands in one list — source, category, status and owner at a glance.',
      rows: [
        { title: 'Dark mode support', source: 'Widget', votes: 234, status: 'In progress', tone: 'info', dot: DOT.info },
        { title: 'CSV export support', source: 'Submit', votes: 189, status: 'Open', tone: 'amber', dot: DOT.amber },
        { title: 'Mobile filters cover the list', source: 'Board', votes: 156, status: 'Resolved', tone: 'success', dot: DOT.success },
        { title: 'Custom retry policy for webhooks', source: 'API', votes: 97, status: 'In progress', tone: 'info', dot: DOT.violet },
        { title: 'Comments on the public roadmap', source: 'Board', votes: 64, status: 'Open', tone: 'amber', dot: DOT.info },
      ],
      footPrefix: '',
      footCount: '2,847',
      footSuffix: 'items in total',
      footAction: 'View all →',
    },
    insight: {
      title: 'Live insight',
      desc: 'Vote trends, source mix and first response time measured with the same metric set.',
      label: 'New this week',
      value: '386',
      delta: '↑ 18.4%',
      distTitle: 'Source mix',
      dist: [
        { label: 'Widget', pct: 46, color: 'var(--lp-brand)' },
        { label: 'Submit page', pct: 32, color: 'var(--lp-amber)' },
        { label: 'Public board', pct: 22, color: 'var(--lp-info)' },
      ],
    },
    collab: {
      title: 'Team collaboration',
      desc: 'Assign owners, add internal notes and move status in bulk — every request keeps its history.',
      rows: [
        { initial: 'L', name: 'Lin Ke', role: 'Product · Owner', note: 'Assigned', color: '#3d5afe' },
        { initial: 'C', name: 'Chen Mo', role: 'Design · Note', note: 'Planned Q4', color: '#f59e0b' },
        { initial: 'Z', name: 'Zhou Ran', role: 'Eng · Status', note: 'In progress', color: '#10b981' },
      ],
    },
    security: {
      title: 'Open and secure',
      desc: 'Embed with a single script tag; signed webhooks, tenant isolation and a full audit log keep data in your hands.',
      comment: '<!-- One script tag embeds the widget -->',
      tags: ['Self-hosted', 'Webhook HMAC', 'Audit log', 'SSO'],
    },
  },
  workflow: {
    kicker: 'How it works',
    title: 'Three steps from feedback to roadmap',
    desc: 'Connect, triage, respond — teams can start right away without migrating history.',
    steps: [
      {
        no: '01',
        title: 'Collect',
        desc: 'Drop one script tag into your site, or share the public submit page and board link. The widget inherits your brand color and language.',
        meta: '≈ 5 min to connect',
      },
      {
        no: '02',
        title: 'Triage',
        desc: 'Filter by votes, category and priority, merge duplicates in bulk, and turn raw user words into a decision-ready list.',
        meta: 'Auto dedupe & classify',
      },
      {
        no: '03',
        title: 'Close the loop',
        desc: 'Status changes, internal notes and the changelog tell the user their request was accepted, scheduled and shipped.',
        meta: 'Fully traceable',
      },
    ],
    foot: 'One script tag to connect — no data migration needed',
    link: 'Read the deployment docs',
  },
  cta: {
    kicker: 'Get started',
    title: 'Let the next piece of feedback land in your inbox',
    desc: 'Open source and free. Deploy in minutes, self-host if you like — the data and the brand stay yours.',
    primary: 'Open dashboard',
    secondary: 'GitHub',
    note: 'MIT License · One-click Docker deploy · No credit card',
  },
  footer: {
    brandDesc: 'Open-source feedback management: collect, triage and respond, so user voices shape the product.',
    status: 'Open source · Self-hostable · MIT License',
    columns: [
      {
        title: 'Product',
        links: [
          { label: 'Features', href: '#capabilities' },
          { label: 'How it works', href: '#workflow' },
          { label: 'Open dashboard', href: '/dashboard' },
        ],
      },
      {
        title: 'Resources',
        links: [
          { label: 'GitHub repo', href: GITHUB_URL },
          { label: 'Deployment docs', href: GITHUB_URL },
          { label: 'Release notes', href: `${GITHUB_URL}/releases` },
        ],
      },
      {
        title: 'Project',
        links: [
          { label: 'License', href: `${GITHUB_URL}/blob/main/LICENSE` },
          { label: 'Issues', href: `${GITHUB_URL}/issues` },
          { label: 'Security', href: `${GITHUB_URL}/blob/main/SECURITY.md` },
        ],
      },
    ],
    copyright: '© 2026 Nexus Feedback · Open-source feedback platform',
    tags: ['v2.0.0', 'MIT License', 'Made for product teams'],
  },
};

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function ArrowRightIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" />
    </svg>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4.5 11.5 11.5 4.5M5.5 4.5h6v6" />
    </svg>
  );
}

function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg {...iconProps} width={size} height={size}>
      <path d="m3 8.5 3 3L13 4.5" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.05-.49.05-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.88 2.34.67.07-.52.28-.88.51-1.08-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function LogoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2.5 4.5A2 2 0 0 1 4.5 2.5h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-3.6 2.8a.5.5 0 0 1-.9-.4V12.5h-1a2 2 0 0 1-2-2v-6Z"
        fill="white"
        fillOpacity="0.94"
      />
      <circle cx="6.2" cy="7.5" r="0.9" fill="#3D5AFE" />
      <circle cx="9" cy="7.5" r="0.9" fill="#3D5AFE" />
      <circle cx="11.8" cy="7.5" r="0.9" fill="#3D5AFE" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 9.5 3.8 3.8A1.5 1.5 0 0 1 5.2 3h5.6a1.5 1.5 0 0 1 1.4.8L14 9.5" />
      <path d="M2 9.5h3.2l.9 1.7h3.8l.9-1.7H14v2.7a1.4 1.4 0 0 1-1.4 1.3H3.4A1.4 1.4 0 0 1 2 12.2V9.5Z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2.5 13.5v-3M6.2 13.5V7.4M9.8 13.5V9.6M13.5 13.5V4" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="6" cy="5.5" r="2.2" />
      <path d="M2.4 13.2c0-2 1.6-3.4 3.6-3.4s3.6 1.4 3.6 3.4" />
      <path d="M11 4.4a2 2 0 0 1 0 3.6M12 9.9c1.3.3 2.2 1.4 2.2 2.9" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg {...iconProps}>
      <path d="M8 2 3.5 3.7v3.9c0 2.7 1.8 5 4.5 6.4 2.7-1.4 4.5-3.7 4.5-6.4V3.7L8 2Z" />
      <path d="m5.9 8 1.5 1.5 2.9-3" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg {...iconProps} width={12} height={12}>
      <rect x="3.2" y="7" width="9.6" height="6" rx="1.4" />
      <path d="M5.3 7V5.4a2.7 2.7 0 0 1 5.4 0V7" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg {...iconProps}>
      <ellipse cx="8" cy="4" rx="5" ry="2" />
      <path d="M3 4v3.7c0 1.1 2.2 2 5 2s5-.9 5-2V4M3 7.7v3.6c0 1.1 2.2 2 5 2s5-.9 5-2V7.7" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg {...iconProps}>
      <rect x="2.2" y="3" width="11.6" height="10" rx="1.6" />
      <path d="m5 6.5 2 1.7-2 1.7M8.4 10h2.6" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="5.5" cy="10.5" r="2.6" />
      <path d="m7.4 8.7 5.3-5.3M10.4 5.7l1.6 1.6M12.1 4l1.6 1.6" />
    </svg>
  );
}

function useScrollReveal(rootRef: React.RefObject<HTMLDivElement>) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) return;

    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    const pending = nodes.filter((node) => node.getBoundingClientRect().top > window.innerHeight);
    for (const node of pending) node.classList.add('lp-reveal-pending');
    if (!pending.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('lp-reveal-in');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.05 },
    );
    for (const node of pending) observer.observe(node);
    return () => observer.disconnect();
  }, [rootRef]);
}

function DashboardMock({ copy }: { copy: LandingCopy['mock'] }) {
  return (
    <div className="lp-mock" role="img" aria-label={copy.aria}>
      <div className="lp-mock-chrome" aria-hidden="true">
        <div className="lp-mock-dots">
          <span className="lp-mock-dot" />
          <span className="lp-mock-dot" />
          <span className="lp-mock-dot" />
        </div>
        <div className="lp-mock-url">
          <LockIcon />
          <span>{copy.url}</span>
        </div>
        <div className="w-[34px]" />
      </div>
      <div className="lp-mock-app" aria-hidden="true">
        <div className="lp-mock-sidebar">
          <div className="lp-mock-sb-brand">
            <span className="lp-mock-sb-logo">N</span>
            <span className="lp-mock-sb-name">{copy.sidebarName}</span>
          </div>
          {copy.sidebarNav.map((item, index) => (
            <div key={item} className={index === 0 ? 'lp-mock-nav is-active' : 'lp-mock-nav'}>
              <span className="lp-mock-nav-dot" />
              {item}
            </div>
          ))}
          <div className="lp-mock-sb-foot">
            <span className="lp-mock-avatar">A</span>
            <span className="lp-mock-sb-user">
              {copy.userName}
              <br />
              {copy.userRole}
            </span>
          </div>
        </div>
        <div className="lp-mock-main">
          <div className="lp-mock-head">
            <div>
              <p className="lp-mock-page-title">{copy.pageTitle}</p>
              <p className="lp-mock-page-sub">{copy.pageSub}</p>
            </div>
            <span className="lp-mock-cta">{copy.newProject}</span>
          </div>
          <div className="lp-mock-kpis">
            {copy.kpis.map((kpi) => (
              <div key={kpi.label} className="lp-kpi">
                <p className="lp-kpi-label">{kpi.label}</p>
                <p className={kpi.tone ? `lp-kpi-value lp-kpi-value--${kpi.tone}` : 'lp-kpi-value'}>{kpi.value}</p>
              </div>
            ))}
          </div>
          <div className="lp-mock-chart">
            <div className="lp-mock-chart-head">
              <span className="lp-mock-chart-title">{copy.chartTitle}</span>
              <span className="lp-mock-legend">
                <span><i className="lp-legend-dot" style={{ background: 'var(--lp-brand)' }} />{copy.legendNew}</span>
                <span><i className="lp-legend-dot" style={{ background: 'var(--lp-success)' }} />{copy.legendSolved}</span>
              </span>
            </div>
            <svg viewBox="0 0 420 58" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="lp-spark-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3D5AFE" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#3D5AFE" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 46 L42 40 L84 43 L126 32 L168 35 L210 24 L252 28 L294 19 L336 22 L378 12 L420 16 L420 58 L0 58 Z"
                fill="url(#lp-spark-fill)"
              />
              <path
                d="M0 46 L42 40 L84 43 L126 32 L168 35 L210 24 L252 28 L294 19 L336 22 L378 12 L420 16"
                fill="none"
                stroke="#3D5AFE"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M0 50 L42 47 L84 48 L126 44 L168 45 L210 41 L252 43 L294 38 L336 39 L378 34 L420 36"
                fill="none"
                stroke="var(--lp-success)"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="lp-mock-list">
            {copy.rows.map((row) => (
              <div key={row.title} className="lp-mock-row">
                <span className="lp-mock-row-dot" style={{ background: row.dot }} />
                <span className="lp-mock-row-title">{row.title}</span>
                <span className="lp-mock-row-source">{row.source}</span>
                <span className="lp-mock-votes">▲ {row.votes}</span>
                <span className={`lp-status lp-status--${row.tone}`}>{row.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroVisual({ copy }: { copy: LandingCopy }) {
  return (
    <div className="lp-hero-visual">
      <DashboardMock copy={copy.mock} />
      <div className="lp-float lp-float-inbox" aria-hidden="true">
        <p className="lp-float-label">
          <span className="lp-pulse" />
          {copy.mock.floatInbox.label}
        </p>
        <p className="lp-float-title">{copy.mock.floatInbox.title}</p>
        <div className="lp-float-meta">
          <span>{copy.mock.floatInbox.votes}</span>
          <span className="lp-status lp-status--info">{copy.mock.floatInbox.status}</span>
        </div>
      </div>
      <div className="lp-float lp-float-stat" aria-hidden="true">
        <p className="lp-float-label">{copy.mock.floatStat.label}</p>
        <p className="lp-float-value">{copy.mock.floatStat.value}</p>
        <p className="lp-float-delta">{copy.mock.floatStat.delta}</p>
      </div>
    </div>
  );
}

function InboxVisual({ copy }: { copy: LandingCopy['capabilities']['inbox'] }) {
  return (
    <div className="lp-inbox">
      {copy.rows.map((row) => (
        <div key={row.title} className="lp-inbox-row">
          <span className="lp-inbox-dot" style={{ background: row.dot }} />
          <span className="lp-inbox-title">{row.title}</span>
          <span className="lp-inbox-meta">
            <span className="lp-source-badge">{row.source}</span>
            <span className="lp-inbox-votes">▲ {row.votes}</span>
          </span>
          <span className={`lp-status lp-status--${row.tone}`}>{row.status}</span>
        </div>
      ))}
      <div className="lp-inbox-foot">
        <span>
          {copy.footPrefix}
          {copy.footPrefix ? ' ' : ''}
          <strong>{copy.footCount}</strong> {copy.footSuffix}
        </span>
        <span>{copy.footAction}</span>
      </div>
    </div>
  );
}

function TrendVisual({ copy }: { copy: LandingCopy['capabilities']['insight'] }) {
  return (
    <div className="lp-trend">
      <div className="lp-trend-top">
        <div>
          <p className="lp-trend-label">{copy.label}</p>
          <p className="lp-trend-value">{copy.value}</p>
        </div>
        <span className="lp-trend-delta">{copy.delta}</span>
      </div>
      <svg viewBox="0 0 220 54" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M0 44 L22 38 L44 41 L66 30 L88 33 L110 22 L132 26 L154 16 L176 20 L198 10 L220 13 L220 54 L0 54 Z"
          fill="var(--lp-brand-soft)"
        />
        <path
          d="M0 44 L22 38 L44 41 L66 30 L88 33 L110 22 L132 26 L154 16 L176 20 L198 10 L220 13"
          fill="none"
          stroke="var(--lp-brand-text)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line x1="0" y1="50.5" x2="220" y2="50.5" stroke="var(--lp-border)" strokeWidth="1" />
      </svg>
      <div className="lp-dist">
        <p className="lp-dist-title">{copy.distTitle}</p>
        {copy.dist.map((item) => (
          <div key={item.label} className="lp-dist-row">
            <span className="lp-dist-name">{item.label}</span>
            <span className="lp-dist-track">
              <i style={{ width: `${item.pct}%`, background: item.color }} />
            </span>
            <span className="lp-dist-pct">{item.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CollabVisual({ copy }: { copy: LandingCopy['capabilities']['collab'] }) {
  return (
    <div className="lp-collab">
      {copy.rows.map((row) => (
        <div key={row.name} className="lp-collab-row">
          <span className="lp-avatar-sm" style={{ background: row.color }}>{row.initial}</span>
          <span className="lp-collab-name">{row.name}</span>
          <span className="lp-collab-role">{row.role}</span>
          <span className="lp-collab-note">{row.note}</span>
        </div>
      ))}
    </div>
  );
}

function OpenSourceVisual({ copy }: { copy: LandingCopy['capabilities']['security'] }) {
  return (
    <div>
      <div className="lp-code">
        <div className="lp-code-bar">
          <TerminalIcon />
          embed.html
        </div>
        <pre>
          <span className="lp-tok-c">{copy.comment}</span>
          {'\n'}
          <span className="lp-tok-k">{'<script'}</span>
          {' '}
          <span className="lp-tok-v">{'src'}</span>
          <span className="lp-tok-c">{'='}</span>
          <span className="lp-tok-s">{'"https://cdn.nexus-feedback.dev/widget.js"'}</span>
          {'\n        '}
          <span className="lp-tok-v">{'data-project'}</span>
          <span className="lp-tok-c">{'='}</span>
          <span className="lp-tok-s">{'"demo-project"'}</span>
          {' '}
          <span className="lp-tok-v">{'defer'}</span>
          <span className="lp-tok-k">{'></script>'}</span>
        </pre>
      </div>
      <div className="lp-tags">
        {copy.tags.map((tag, index) => (
          <span key={tag} className="lp-tag">
            {index === 0 ? <DatabaseIcon /> : index === 1 ? <KeyIcon /> : index === 2 ? <ShieldIcon /> : <UsersIcon />}
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Landing() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const pageRef = useRef<HTMLDivElement>(null);
  useScrollReveal(pageRef);

  const copy = i18n.language?.toLowerCase().startsWith('en') ? EN_COPY : ZH_COPY;

  const toggleLanguage = () => {
    const next = i18n.language?.toLowerCase().startsWith('en') ? 'zh' : 'en';
    i18n.changeLanguage(next);
    try {
      localStorage.setItem('lang', next);
    } catch {
      // ignore storage failures (private mode)
    }
  };

  const capabilities = [
    {
      key: 'inbox',
      wide: true,
      icon: <InboxIcon />,
      title: copy.capabilities.inbox.title,
      desc: copy.capabilities.inbox.desc,
      visual: <InboxVisual copy={copy.capabilities.inbox} />,
    },
    {
      key: 'insight',
      wide: false,
      icon: <ChartIcon />,
      title: copy.capabilities.insight.title,
      desc: copy.capabilities.insight.desc,
      visual: <TrendVisual copy={copy.capabilities.insight} />,
    },
    {
      key: 'collab',
      wide: false,
      icon: <UsersIcon />,
      title: copy.capabilities.collab.title,
      desc: copy.capabilities.collab.desc,
      visual: <CollabVisual copy={copy.capabilities.collab} />,
    },
    {
      key: 'security',
      wide: true,
      icon: <ShieldIcon />,
      title: copy.capabilities.security.title,
      desc: copy.capabilities.security.desc,
      visual: <OpenSourceVisual copy={copy.capabilities.security} />,
    },
  ];

  return (
    <div ref={pageRef} id="top" className="lp">
      <a className="lp-skip" href="#main">
        {copy.skipLink}
      </a>

      <header className="lp-nav">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-5 sm:px-8">
          <a href="#top" className="lp-brand" aria-label={copy.nav.homeAria}>
            <span className="lp-logo"><LogoMark /></span>
            <span>
              <span className="lp-wordmark">{BRAND_NAME}</span>
              <span className="lp-wordmark-sub">{BRAND_SUB}</span>
            </span>
          </a>
          <nav className="lp-nav-links" aria-label={copy.nav.navAria}>
            {copy.nav.links.map((link) => (
              <a key={link.href} href={link.href} className="lp-nav-link">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              className="lp-lang-toggle"
              onClick={toggleLanguage}
              aria-label={copy.langToggleAria}
            >
              {copy.langToggleLabel}
            </button>
            <a
              className="lp-btn lp-btn-ghost lp-btn-sm hidden sm:inline-flex"
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <GithubIcon />
              {copy.nav.github}
            </a>
            <button type="button" className="lp-btn lp-btn-primary lp-btn-sm" onClick={() => navigate('/dashboard')}>
              {copy.nav.cta}
            </button>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="lp-hero">
          <div className="lp-hero-bg" aria-hidden="true">
            <div className="lp-grid-bg" />
            <div className="lp-glow lp-glow-a" />
            <div className="lp-glow lp-glow-b" />
          </div>
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 sm:pt-14 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:gap-14 lg:pb-20 lg:pt-16">
            <div className="min-w-0">
              <p className="lp-eyebrow lp-enter lp-enter-1">
                <span className="lp-pulse" />
                {copy.hero.badge}
              </p>
              <h1 className="lp-h1 lp-enter lp-enter-2">
                {copy.hero.titleA}
                <span className="lp-h1-accent">{copy.hero.titleB}</span>
              </h1>
              <p className="lp-lede lp-enter lp-enter-3">{copy.hero.lede}</p>
              <div className="lp-actions lp-enter lp-enter-4">
                <button type="button" className="lp-btn lp-btn-primary" onClick={() => navigate('/dashboard')}>
                  {copy.hero.ctaPrimary}
                  <ArrowRightIcon />
                </button>
                <a
                  className="lp-btn lp-btn-secondary"
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {copy.hero.ctaSecondary}
                  <ArrowUpRightIcon />
                </a>
              </div>
              <div className="lp-proof lp-enter lp-enter-4">
                <div className="lp-avatars" aria-hidden="true">
                  {copy.hero.proofInitials.map((initial, index) => (
                    <span key={initial} className={`lp-avatar lp-avatar-${index + 1}`}>{initial}</span>
                  ))}
                </div>
                <p className="lp-proof-text">
                  <strong>{copy.hero.proofStrong}</strong> {copy.hero.proofText}
                </p>
              </div>
            </div>
            <div className="lp-enter-mock">
              <HeroVisual copy={copy} />
            </div>
          </div>
        </section>

        {/* Metrics / trust band */}
        <section className="lp-band" aria-label={copy.metricsAria}>
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="lp-metrics">
              {copy.metrics.map((metric) => (
                <div key={metric.label} className="lp-metric">
                  <p className="lp-metric-value">{metric.value}</p>
                  <p className="lp-metric-label">{metric.label}</p>
                  <p className="lp-metric-note">{metric.note}</p>
                </div>
              ))}
            </div>
            <div className="lp-band-note">
              {copy.trust.map((point) => (
                <span key={point}>
                  <CheckIcon />
                  {point}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section id="capabilities" className="lp-section">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="lp-section-head" data-reveal>
              <div>
                <p className="lp-kicker">{copy.capabilities.kicker}</p>
                <h2 className="lp-h2">{copy.capabilities.title}</h2>
                <p className="lp-section-desc">{copy.capabilities.desc}</p>
              </div>
              <a className="lp-section-link" href="#workflow">
                {copy.capabilities.link}
                <ArrowRightIcon />
              </a>
            </div>
            <div className="lp-bento">
              {capabilities.map((capability) => (
                <article
                  key={capability.key}
                  className={capability.wide ? 'lp-feature lp-feature--wide' : 'lp-feature'}
                  data-reveal
                >
                  <div className="lp-feature-head">
                    <span className="lp-feature-icon">{capability.icon}</span>
                    <h3 className="lp-feature-title">{capability.title}</h3>
                  </div>
                  <p className="lp-feature-desc">{capability.desc}</p>
                  <div className="lp-feature-visual">{capability.visual}</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="lp-section lp-section--white">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="lp-section-head" data-reveal>
              <div>
                <p className="lp-kicker">{copy.workflow.kicker}</p>
                <h2 className="lp-h2">{copy.workflow.title}</h2>
                <p className="lp-section-desc">{copy.workflow.desc}</p>
              </div>
            </div>
            <div className="lp-steps">
              {copy.workflow.steps.map((step) => (
                <div key={step.no} className="lp-step" data-reveal>
                  <span className="lp-step-no">{step.no}</span>
                  <h3 className="lp-step-title">{step.title}</h3>
                  <p className="lp-step-desc">{step.desc}</p>
                  <p className="lp-step-meta">
                    <CheckIcon />
                    {step.meta}
                  </p>
                </div>
              ))}
            </div>
            <div className="lp-workflow-foot" data-reveal>
              <span>{copy.workflow.foot}</span>
              <a className="lp-section-link" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                {copy.workflow.link}
                <ArrowUpRightIcon />
              </a>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section id="start" className="lp-section">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="lp-cta" data-reveal>
              <div className="lp-cta-glow lp-cta-glow-a" aria-hidden="true" />
              <div className="lp-cta-glow lp-cta-glow-b" aria-hidden="true" />
              <div className="lp-cta-content">
                <p className="lp-cta-kicker">{copy.cta.kicker}</p>
                <h2 className="lp-cta-h2">{copy.cta.title}</h2>
                <p className="lp-cta-desc">{copy.cta.desc}</p>
                <div className="lp-cta-actions">
                  <button type="button" className="lp-btn lp-btn-light" onClick={() => navigate('/dashboard')}>
                    {copy.cta.primary}
                    <ArrowRightIcon />
                  </button>
                  <a
                    className="lp-btn lp-btn-outline-light"
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <GithubIcon />
                    {copy.cta.secondary}
                  </a>
                </div>
                <p className="lp-cta-note">{copy.cta.note}</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="lp-footer-grid">
            <div>
              <a href="#top" className="lp-brand" aria-label={copy.nav.homeAria}>
                <span className="lp-logo"><LogoMark /></span>
                <span>
                  <span className="lp-wordmark">{BRAND_NAME}</span>
                  <span className="lp-wordmark-sub">{BRAND_SUB}</span>
                </span>
              </a>
              <p className="lp-footer-brand-desc">{copy.footer.brandDesc}</p>
              <p className="lp-footer-status">
                <i />
                {copy.footer.status}
              </p>
            </div>
            {copy.footer.columns.map((column) => (
              <div key={column.title}>
                <p className="lp-footer-title">{column.title}</p>
                <div className="lp-footer-links">
                  {column.links.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      className="lp-footer-link"
                      {...(link.href.startsWith('http')
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    >
                      {link.label}
                      {link.href.startsWith('http') && <ArrowUpRightIcon />}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="lp-footer-bottom">
            <span>{copy.footer.copyright}</span>
            <span className="lp-footer-bottom-tags">
              {copy.footer.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
