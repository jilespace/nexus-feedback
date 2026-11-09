import type { LandingCopy } from './copy';
import {
  DatabaseIcon,
  KeyIcon,
  LockIcon,
  ShieldIcon,
  TerminalIcon,
  UsersIcon,
} from './icons';

// Dashboard preview shown in the hero, plus the capability feature visuals.

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

export function HeroVisual({ copy }: { copy: LandingCopy }) {
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

export function InboxVisual({ copy }: { copy: LandingCopy['capabilities']['inbox'] }) {
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

export function TrendVisual({ copy }: { copy: LandingCopy['capabilities']['insight'] }) {
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

export function CollabVisual({ copy }: { copy: LandingCopy['capabilities']['collab'] }) {
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

export function OpenSourceVisual({ copy }: { copy: LandingCopy['capabilities']['security'] }) {
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