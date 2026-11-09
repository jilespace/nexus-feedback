import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FeedbackForm } from './FeedbackForm';
import { t, Locale } from './i18n';
import { loadWidgetConfig, ServerWidgetConfig } from './configLoader';
import { extractProjectSlug } from './api';
import { resolveColor, resolveDensity, resolveRadius } from './theme';
import { useFocusTrap } from './useFocusTrap';
import { WIDGET_CSS } from './styles';
import { ChatIcon, CloseIcon, ClockIcon } from './icons';
import { ErrorState, SuccessState } from './WidgetStates';
import type { WidgetConfig } from './index';

type View = 'form' | 'success' | 'error';

const CLOSE_ANIMATION_MS = 170;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 用 Shadow DOM 隔离宿主页面样式与 Widget 样式，避免双向污染。 */
function ShadowHost({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shadow, setShadow] = useState<ShadowRoot | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.setAttribute('data-nexus-widget', '');
    style.textContent = WIDGET_CSS;
    root.appendChild(style);
    setShadow(root);
    return () => {
      style.remove();
    };
  }, []);

  return (
    <>
      <div
        ref={hostRef}
        style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0, zIndex: 2147483000 }}
      />
      {shadow ? createPortal(children, shadow) : null}
    </>
  );
}

export function FeedbackWidget({ apiKey, apiUrl, position, theme, locale = 'zh' }: WidgetConfig & { locale?: Locale }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [view, setView] = useState<View>('form');
  const [errorMessage, setErrorMessage] = useState('');
  const [formKey, setFormKey] = useState(0);
  const [serverConfig, setServerConfig] = useState<ServerWidgetConfig | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [pulse, setPulse] = useState(true);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const stateTitleRef = useRef<HTMLHeadingElement>(null);
  const wasOpenRef = useRef(false);
  const suppressTooltipRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadWidgetConfig(apiUrl, apiKey).then((config) => {
      if (!cancelled && config) setServerConfig(config);
    });
    return () => {
      cancelled = true;
    };
  }, [apiUrl, apiKey]);

  useEffect(() => {
    const show = window.setTimeout(() => setTooltipVisible(true), 1200);
    const hide = window.setTimeout(() => setTooltipVisible(false), 5600);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, []);

  useEffect(() => {
    if (!pulse) return;
    const timer = window.setTimeout(() => setPulse(false), 4600);
    return () => window.clearTimeout(timer);
  }, [pulse]);

  const color = resolveColor(theme?.primaryColor ?? serverConfig?.primaryColor);
  const radius = resolveRadius(theme?.radius);
  const density = resolveDensity(theme?.density);
  const resolvedPosition = position ?? serverConfig?.position ?? 'bottom-right';
  const buttonLabel = theme?.buttonLabel ?? serverConfig?.buttonLabel ?? t(locale, 'feedback');
  const projectSlug = serverConfig?.project?.slug ?? extractProjectSlug(apiUrl);
  const showCategory = serverConfig?.fields?.category !== false;
  const showPriority = serverConfig?.fields?.priority !== false;
  const showContact = serverConfig?.fields?.contact !== false;
  const successTitle = serverConfig?.successTitle?.trim() || t(locale, 'thankYou');
  const successMessage = serverConfig?.successMessage?.trim() || t(locale, 'thankYouDetail');

  const rootStyle = useMemo<CSSProperties>(
    () =>
      ({
        '--nf-primary': color.hex,
        '--nf-primary-rgb': color.rgb,
        '--nf-radius': `${radius}px`,
      }) as CSSProperties,
    [color.hex, color.rgb, radius],
  );

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(
      () => {
        setOpen(false);
        setClosing(false);
        setTooltipVisible(false);
      },
      prefersReducedMotion() ? 0 : CLOSE_ANIMATION_MS,
    );
  }, []);

  const openPanel = () => {
    if (view === 'success') {
      setView('form');
      setFormKey((key) => key + 1);
    }
    setOpen(true);
    setClosing(false);
    setTooltipVisible(false);
  };

  useFocusTrap(open && !closing, panelRef, close, launcherRef);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    const timer = window.setTimeout(() => {
      suppressTooltipRef.current = true;
      launcherRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || view === 'form') return;
    const timer = window.setTimeout(
      () => stateTitleRef.current?.focus(),
      prefersReducedMotion() ? 0 : 200,
    );
    return () => window.clearTimeout(timer);
  }, [open, view]);

  // 从成功/错误态回到表单（或点击「再提交一条」重挂载）时，把焦点放回标题输入框。
  useEffect(() => {
    if (!open || view !== 'form') return;
    const timer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('[data-autofocus="true"]')?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, view, formKey]);

  useEffect(() => {
    if (!open) return;
    if (!window.matchMedia || !window.matchMedia('(max-width: 520px)').matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const tooltipSide = resolvedPosition === 'bottom-left' ? 'left' : 'right';

  return (
    <ShadowHost>
      <div className="nf-root" data-position={resolvedPosition} data-density={density} style={rootStyle}>
        {!open ? (
          <>
            <div className="nf-tooltip" data-side={tooltipSide} data-visible={tooltipVisible} role="tooltip" id="nf-tooltip">
              {t(locale, 'tooltip')}
            </div>
            <button
              ref={launcherRef}
              type="button"
              className="nf-launcher"
              data-pulse={pulse}
              aria-label={buttonLabel}
              aria-describedby="nf-tooltip"
              onMouseEnter={() => setTooltipVisible(true)}
              onMouseLeave={() => setTooltipVisible(false)}
              onFocus={() => {
                if (suppressTooltipRef.current) {
                  suppressTooltipRef.current = false;
                  return;
                }
                setTooltipVisible(true);
              }}
              onBlur={() => setTooltipVisible(false)}
              onClick={openPanel}
            >
              <ChatIcon />
              {buttonLabel}
            </button>
          </>
        ) : (
          <div
            ref={panelRef}
            className="nf-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nf-panel-title"
            data-closing={closing}
            tabIndex={-1}
          >
            <div className="nf-panel-header">
              <div className="nf-panel-heading">
                <p className="nf-panel-eyebrow">{t(locale, 'panelEyebrow')}</p>
                <h2 className="nf-panel-title" id="nf-panel-title">
                  {t(locale, 'panelTitle')}
                </h2>
                <p className="nf-panel-sub">
                  <ClockIcon />
                  {t(locale, 'panelSubtitle')}
                </p>
              </div>
              <button type="button" className="nf-close" onClick={close} aria-label={t(locale, 'close')}>
                <CloseIcon />
              </button>
            </div>

            <div className="nf-panel-body">
              <div className={view === 'form' ? 'nf-form-wrap' : 'nf-form-wrap nf-hidden'}>
                <FeedbackForm
                  key={formKey}
                  apiKey={apiKey}
                  apiUrl={apiUrl}
                  locale={locale}
                  projectSlug={projectSlug}
                  showCategory={showCategory}
                  showPriority={showPriority}
                  showContact={showContact}
                  onSuccess={() => setView('success')}
                  onError={(message) => {
                    setErrorMessage(message);
                    setView('error');
                  }}
                />
              </div>

              {view === 'success' && (
                <SuccessState
                  title={successTitle}
                  message={successMessage}
                  locale={locale}
                  titleRef={stateTitleRef}
                  onDone={close}
                  onAgain={() => {
                    setFormKey((key) => key + 1);
                    setView('form');
                  }}
                />
              )}

              {view === 'error' && (
                <ErrorState
                  message={errorMessage}
                  locale={locale}
                  titleRef={stateTitleRef}
                  onBack={() => setView('form')}
                  onClose={close}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </ShadowHost>
  );
}
