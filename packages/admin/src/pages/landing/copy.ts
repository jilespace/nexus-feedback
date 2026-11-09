// Landing page copy dictionaries and shared landing constants.

const GITHUB_URL = 'https://github.com/nexus-feedback/nexus-feedback';
const BRAND_NAME = 'Nexus Feedback';
const BRAND_SUB = 'Feedback OS';

export { GITHUB_URL, BRAND_NAME, BRAND_SUB };

type Tone = 'info' | 'amber' | 'success';

type StatusRow = {
  title: string;
  source: string;
  votes: number;
  status: string;
  tone: Tone;
  dot: string;
};

export type LandingCopy = {
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

export const ZH_COPY: LandingCopy = {
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

export const EN_COPY: LandingCopy = {
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