// Landing page types and shared landing constants.
// All translated copy lives in the `landing` i18n namespace:
// packages/admin/src/i18n/locales/{zh,en}/landing.json

const GITHUB_URL = 'https://github.com/jilespace/nexus-feedback';
const BRAND_NAME = 'Nexus Feedback';
const BRAND_SUB = 'Feedback OS';

export { GITHUB_URL, BRAND_NAME, BRAND_SUB };

export type LandingTone = 'info' | 'amber' | 'success';

export type LandingStatusRow = {
  title: string;
  source: string;
  votes: number;
  status: string;
  tone: LandingTone;
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
    rows: LandingStatusRow[];
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
      rows: LandingStatusRow[];
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

/**
 * Raw `capabilities` section as stored in the `landing` namespace. The inbox
 * footer count is one `{{count}}` template because an empty translation value
 * is not allowed for locale-parity, so it is split before rendering.
 */
export type LandingCapabilitiesRaw = Omit<LandingCopy['capabilities'], 'inbox'> & {
  inbox: Omit<LandingCopy['capabilities']['inbox'], 'footPrefix' | 'footSuffix'> & {
    footTemplate: string;
  };
};

export function splitFootTemplate(template: string): { footPrefix: string; footSuffix: string } {
  const [before = '', after = ''] = template.split('{{count}}');
  return { footPrefix: before.trim(), footSuffix: after.trim() };
}
