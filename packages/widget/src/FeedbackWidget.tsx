import { useState, useEffect } from 'react';
import { FeedbackForm } from './FeedbackForm';
import { t, Locale } from './i18n';
import { loadWidgetConfig, ServerWidgetConfig } from './configLoader';
import type { WidgetConfig } from './index';

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export function FeedbackWidget({ apiKey, apiUrl, position, theme, locale = 'zh' }: WidgetConfig & { locale?: Locale }) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [showPulse, setShowPulse] = useState(true);
  const [animState, setAnimState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
  const [serverConfig, setServerConfig] = useState<ServerWidgetConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadWidgetConfig(apiUrl, apiKey).then(cfg => {
      if (!cancelled && cfg) setServerConfig(cfg);
    });
    return () => { cancelled = true; };
  }, [apiUrl, apiKey]);

  const primaryColor = theme?.primaryColor ?? serverConfig?.primaryColor ?? '#4c6ef5';
  const buttonLabel = theme?.buttonLabel ?? serverConfig?.buttonLabel ?? t(locale, 'feedback');
  const rgb = hexToRgb(primaryColor);

  useEffect(() => { const t = setTimeout(() => setShowPulse(false), 3000); return () => clearTimeout(t); }, []);

  const handleOpen = () => { setOpen(true); setSubmitted(false); setError(''); setAnimState('opening'); setTimeout(() => setAnimState('open'), 20); };
  const handleClose = () => { setAnimState('closing'); setTimeout(() => { setOpen(false); setAnimState('closed'); }, 200); };

  const positionStyle = (position ?? serverConfig?.position) === 'bottom-left' ? { right: 'auto', left: '20px' } : { right: '20px', left: 'auto' };

  const pulseKeyframes = showPulse ? `@keyframes nf-pulse{0%,100%{box-shadow:0 4px 12px rgba(${rgb},0.25)}50%{box-shadow:0 4px 24px rgba(${rgb},0.5)}}` : '';
  const slideKeyframes = `@keyframes nf-slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes nf-slideDown{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(12px)}}`;
  const checkKeyframes = `@keyframes nf-check{0%{stroke-dashoffset:24}100%{stroke-dashoffset:0}}@keyframes nf-circle{0%{stroke-dashoffset:100}100%{stroke-dashoffset:0}}`;

  const popupAnim = animState === 'opening' || animState === 'open'
    ? { animation: 'nf-slideUp 0.2s ease forwards' }
    : animState === 'closing' ? { animation: 'nf-slideDown 0.2s ease forwards' } : {};

  return (
    <div style={{ position: 'fixed', bottom: '20px', ...positionStyle, zIndex: 99999, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' }}>
      <style>{pulseKeyframes}{slideKeyframes}{checkKeyframes}</style>
      {!open && (
        <button onClick={handleOpen} aria-label="Open feedback form" style={{
          display: 'flex', alignItems: 'center', gap: '8px', background: primaryColor, color: '#fff',
          border: 'none', borderRadius: '24px', padding: '10px 18px', fontSize: '14px', fontWeight: 600,
          cursor: 'pointer', boxShadow: `0 4px 12px rgba(${rgb},0.25)`,
          animation: showPulse ? 'nf-pulse 1.5s ease-in-out infinite' : 'none', transition: 'transform 0.15s',
        }} onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')} onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          {buttonLabel}
        </button>
      )}
      {open && (
        <div style={{ width: '360px', background: '#fff', borderRadius: '14px', boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden', ...popupAnim }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`, color: '#fff' }}>
            <span style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              {t(locale, 'submitFeedback')}
            </span>
            <button onClick={handleClose} aria-label="Close feedback form" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '14px', lineHeight: 1 }}>×</button>
          </div>
          {submitted ? (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 48 48" style={{ margin: '0 auto 12px' }}>
                <circle cx="24" cy="24" r="20" fill="none" stroke="#4caf50" strokeWidth="3" strokeDasharray="100" style={{ animation: 'nf-circle 0.5s ease forwards' }}/>
                <path d="M15 25l6 6 12-12" fill="none" stroke="#4caf50" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="24" style={{ animation: 'nf-check 0.3s 0.4s ease forwards', strokeDashoffset: 24 }}/>
              </svg>
              <p style={{ fontSize: '15px', color: '#333', fontWeight: 600, margin: '0 0 4px' }}>{serverConfig?.successTitle ?? t(locale, 'thankYou')}</p>
              <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>{serverConfig?.successMessage ?? t(locale, 'thankYouDetail')}</p>
            </div>
          ) : error && !submitted ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fee', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              </div>
              <p style={{ fontSize: '14px', color: '#333', fontWeight: 500, margin: '0 0 4px' }}>{t(locale, 'submitFailed')}</p>
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 12px' }}>{error}</p>
              <button onClick={() => setError('')} style={{ background: primaryColor, color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>{t(locale, 'retry')}</button>
            </div>
          ) : (
            <FeedbackForm apiKey={apiKey} apiUrl={apiUrl} primaryColor={primaryColor} onSuccess={() => setSubmitted(true)} onError={(msg) => setError(msg)} locale={locale} />
          )}
        </div>
      )}
    </div>
  );
}
