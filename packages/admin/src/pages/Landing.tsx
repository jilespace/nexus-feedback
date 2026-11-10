import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '@fontsource-variable/instrument-sans/wght.css';
import '@/styles/landing.css';
import { BRAND_NAME, BRAND_SUB, GITHUB_URL, splitFootTemplate } from './landing/copy';
import type { LandingCapabilitiesRaw, LandingCopy } from './landing/copy';
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  ChartIcon,
  CheckIcon,
  GithubIcon,
  InboxIcon,
  LogoMark,
  ShieldIcon,
  UsersIcon,
} from './landing/icons';
import { useScrollReveal } from './landing/useScrollReveal';
import {
  CollabVisual,
  HeroVisual,
  InboxVisual,
  OpenSourceVisual,
  TrendVisual,
} from './landing/MockPanel';

export function Landing() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('landing');
  const pageRef = useRef<HTMLDivElement>(null);
  useScrollReveal(pageRef);

  // Copy is read from the `landing` namespace on every render, so switching the
  // language re-renders all text without a reload.
  const capabilitiesRaw = t('capabilities', { returnObjects: true }) as unknown as LandingCapabilitiesRaw;
  const copy: LandingCopy = {
    langToggleLabel: t('langToggleLabel'),
    langToggleAria: t('langToggleAria'),
    skipLink: t('skipLink'),
    nav: t('nav', { returnObjects: true }) as unknown as LandingCopy['nav'],
    hero: t('hero', { returnObjects: true }) as unknown as LandingCopy['hero'],
    mock: t('mock', { returnObjects: true }) as unknown as LandingCopy['mock'],
    metricsAria: t('metricsAria'),
    metrics: t('metrics', { returnObjects: true }) as unknown as LandingCopy['metrics'],
    trust: t('trust', { returnObjects: true }) as unknown as LandingCopy['trust'],
    capabilities: {
      ...capabilitiesRaw,
      inbox: {
        ...capabilitiesRaw.inbox,
        ...splitFootTemplate(capabilitiesRaw.inbox.footTemplate),
      },
    },
    workflow: t('workflow', { returnObjects: true }) as unknown as LandingCopy['workflow'],
    cta: t('cta', { returnObjects: true }) as unknown as LandingCopy['cta'],
    footer: t('footer', { returnObjects: true }) as unknown as LandingCopy['footer'],
  };

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