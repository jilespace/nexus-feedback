export const WIDGET_CSS = `
.nf-root,
.nf-root * ,
.nf-root *::before,
.nf-root *::after { box-sizing: border-box; }

.nf-root {
  position: fixed;
  z-index: 2147483000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;
  --nf-primary: #4c6ef5;
  --nf-primary-rgb: 76, 110, 245;
  --nf-radius: 16px;
  --nf-space: 12px;
  --nf-text: #0f172a;
  --nf-text-2: #475569;
  --nf-text-3: #7b8794;
  --nf-line: #e5e8ee;
  --nf-line-strong: #cbd2de;
  --nf-bg: #ffffff;
  --nf-bg-subtle: #f9fafb;
  --nf-danger: #dc2626;
  --nf-success: #059669;
  --nf-focus: 0 0 0 3px rgba(var(--nf-primary-rgb), 0.18);
  color: var(--nf-text);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.nf-root[data-density='comfortable'] { --nf-space: 16px; }

.nf-root button,
.nf-root input,
.nf-root textarea {
  font: inherit;
  color: inherit;
  margin: 0;
}

.nf-root button { cursor: pointer; }

.nf-root :focus-visible {
  outline: 2px solid var(--nf-primary);
  outline-offset: 2px;
}

/* ---------- launcher ---------- */
.nf-launcher {
  position: fixed;
  right: 16px;
  bottom: 20px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 18px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: calc(var(--nf-radius) * 2.5);
  background: var(--nf-primary);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  box-shadow: 0 8px 24px -8px rgba(var(--nf-primary-rgb), 0.65), 0 2px 6px rgba(15, 23, 42, 0.16);
  transition: transform 150ms ease, box-shadow 150ms ease, filter 150ms ease;
}
.nf-root[data-position='bottom-left'] .nf-launcher { right: auto; left: 16px; }
.nf-launcher:hover {
  transform: translateY(-1px);
  filter: brightness(1.07);
  box-shadow: 0 12px 28px -10px rgba(var(--nf-primary-rgb), 0.7), 0 3px 8px rgba(15, 23, 42, 0.18);
}
.nf-launcher:active { transform: translateY(0); }
.nf-launcher svg { width: 18px; height: 18px; flex-shrink: 0; }
.nf-launcher[data-pulse='true'] { animation: nf-pulse 2.2s ease-in-out 2; }

.nf-tooltip {
  position: fixed;
  max-width: 220px;
  padding: 7px 10px;
  border-radius: 8px;
  background: #0f172a;
  color: #f8fafc;
  font-size: 11.5px;
  line-height: 1.45;
  box-shadow: 0 10px 24px -10px rgba(15, 23, 42, 0.55);
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 150ms ease, transform 150ms ease;
  pointer-events: none;
}
.nf-tooltip::after {
  content: '';
  position: absolute;
  bottom: -3px;
  width: 7px;
  height: 7px;
  background: #0f172a;
  transform: rotate(45deg);
  border-radius: 1px;
}
.nf-tooltip[data-visible='true'] { opacity: 1; transform: translateY(0); }
.nf-tooltip[data-side='right'] { right: 20px; bottom: 76px; }
.nf-tooltip[data-side='right']::after { right: 26px; }
.nf-tooltip[data-side='left'] { left: 20px; bottom: 76px; }
.nf-tooltip[data-side='left']::after { left: 26px; }

/* ---------- panel ---------- */
.nf-panel {
  position: fixed;
  right: 16px;
  bottom: 20px;
  width: 384px;
  max-width: calc(100vw - 32px);
  max-height: min(720px, calc(100dvh - 32px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--nf-bg);
  border: 1px solid var(--nf-line);
  border-radius: var(--nf-radius);
  box-shadow: 0 24px 64px -28px rgba(15, 23, 42, 0.5), 0 10px 24px -12px rgba(15, 23, 42, 0.22);
  animation: nf-panel-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.nf-root[data-position='bottom-left'] .nf-panel { right: auto; left: 16px; }
.nf-panel[data-closing='true'] { animation: nf-panel-out 170ms ease-out both; }

.nf-panel-header {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 18px 15px;
  background:
    radial-gradient(140% 160% at 0% 0%, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0) 58%),
    var(--nf-primary);
  color: #fff;
}
.nf-panel-heading { flex: 1; min-width: 0; }
.nf-panel-eyebrow {
  margin: 0;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.78;
}
.nf-panel-title {
  margin: 4px 0 0;
  font-size: 16px;
  font-weight: 650;
  letter-spacing: -0.01em;
  line-height: 1.3;
}
.nf-panel-sub {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 5px 0 0;
  font-size: 11.5px;
  line-height: 1.45;
  opacity: 0.85;
}
.nf-panel-sub svg { width: 12px; height: 12px; flex-shrink: 0; }
.nf-close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  transition: background-color 150ms ease;
}
.nf-close:hover { background: rgba(255, 255, 255, 0.28); }
.nf-close svg { width: 14px; height: 14px; }

.nf-panel-body {
  padding: 16px 18px 18px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* ---------- form ---------- */
.nf-form { display: flex; flex-direction: column; gap: var(--nf-space); }
.nf-form-wrap { min-width: 0; }
.nf-hidden { display: none !important; }
.nf-form-actions { display: flex; flex-direction: column; gap: 8px; }
.nf-field { display: flex; flex-direction: column; gap: 6px; }
.nf-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--nf-text-2);
}
.nf-label-optional { font-weight: 400; font-size: 11px; color: var(--nf-text-3); }
.nf-counter { font-size: 11px; color: var(--nf-text-3); font-variant-numeric: tabular-nums; }
.nf-counter[data-over='true'] { color: var(--nf-danger); font-weight: 600; }

.nf-input,
.nf-textarea {
  width: 100%;
  border: 1px solid var(--nf-line-strong);
  border-radius: 10px;
  background: #fff;
  color: var(--nf-text);
  font-size: 13px;
  line-height: 1.5;
  padding: 8px 11px;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.nf-input { height: 38px; }
.nf-textarea { min-height: 84px; resize: vertical; }
.nf-input::placeholder,
.nf-textarea::placeholder { color: #9aa4b2; }
.nf-input:hover,
.nf-textarea:hover { border-color: #b6bfd0; }
.nf-input:focus,
.nf-textarea:focus {
  outline: none;
  border-color: var(--nf-primary);
  box-shadow: var(--nf-focus);
}
.nf-input[aria-invalid='true'],
.nf-textarea[aria-invalid='true'] {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}
.nf-error {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--nf-danger);
}
.nf-error svg { width: 12px; height: 12px; flex-shrink: 0; }

/* ---------- category chips ---------- */
.nf-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.nf-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 11px;
  border: 1px solid var(--nf-line);
  border-radius: calc(var(--nf-radius) * 0.6);
  background: #fff;
  color: var(--nf-text-2);
  font-size: 12px;
  font-weight: 500;
  transition: border-color 150ms ease, background-color 150ms ease, color 150ms ease;
}
.nf-chip:hover { border-color: var(--nf-line-strong); background: var(--nf-bg-subtle); }
.nf-chip[data-selected='true'] {
  border-color: var(--nf-primary);
  background: rgba(var(--nf-primary-rgb), 0.08);
  color: var(--nf-primary);
  box-shadow: inset 0 0 0 1px var(--nf-primary);
}
.nf-chip-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: 0.8; }
.nf-chip-skeleton { width: 68px; height: 30px; border-radius: calc(var(--nf-radius) * 0.6); background: #eef0f4; animation: nf-shimmer 1.4s ease-in-out infinite; }

/* ---------- attachments ---------- */
.nf-attach-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.nf-attach-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 11px;
  border: 1px dashed var(--nf-line-strong);
  border-radius: 9px;
  background: var(--nf-bg-subtle);
  color: var(--nf-text-2);
  font-size: 12px;
  transition: border-color 150ms ease, color 150ms ease, background-color 150ms ease;
}
.nf-attach-btn:hover,
.nf-attach-btn[data-drag='true'] {
  border-color: var(--nf-primary);
  color: var(--nf-primary);
  background: rgba(var(--nf-primary-rgb), 0.06);
}
.nf-attach-btn svg { width: 13px; height: 13px; }
.nf-attach-count { font-size: 11px; color: var(--nf-text-3); font-variant-numeric: tabular-nums; }
.nf-file-list { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.nf-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border: 1px solid var(--nf-line);
  border-radius: 9px;
  background: var(--nf-bg-subtle);
}
.nf-file[data-status='error'] { border-color: rgba(239, 68, 68, 0.35); background: #fef2f2; }
.nf-file-icon { display: grid; place-items: center; width: 22px; height: 22px; flex-shrink: 0; color: var(--nf-text-3); }
.nf-file-icon svg { width: 14px; height: 14px; }
.nf-file[data-status='error'] .nf-file-icon { color: var(--nf-danger); }
.nf-file-main { flex: 1; min-width: 0; }
.nf-file-name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--nf-text); }
.nf-file-meta { display: block; font-size: 10.5px; color: var(--nf-text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nf-file[data-status='error'] .nf-file-meta { color: var(--nf-danger); }
.nf-file-retry {
  flex-shrink: 0;
  padding: 3px 7px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  background: transparent;
  color: var(--nf-danger);
  font-size: 10.5px;
  font-weight: 600;
}
.nf-icon-btn {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--nf-text-3);
  transition: background-color 150ms ease, color 150ms ease;
}
.nf-icon-btn:hover { background: #eef0f4; color: var(--nf-text); }
.nf-icon-btn svg { width: 12px; height: 12px; }

/* ---------- submit ---------- */
.nf-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  height: 42px;
  border: none;
  border-radius: 10px;
  background: var(--nf-primary);
  color: #fff;
  font-size: 13.5px;
  font-weight: 650;
  box-shadow: 0 6px 16px -8px rgba(var(--nf-primary-rgb), 0.75);
  transition: filter 150ms ease, transform 120ms ease, opacity 150ms ease;
}
.nf-submit:hover { filter: brightness(1.07); }
.nf-submit:active { transform: translateY(1px); }
.nf-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
.nf-submit svg { width: 15px; height: 15px; }
.nf-form-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin: 0;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--nf-text-3);
  text-align: center;
}
.nf-form-note svg { width: 11px; height: 11px; flex-shrink: 0; }

/* ---------- success / error states ---------- */
.nf-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 26px 20px 22px;
  text-align: center;
  animation: nf-state-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.nf-state-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
}
.nf-state-icon[data-tone='success'] { background: #ecfdf5; border: 1px solid rgba(16, 185, 129, 0.32); color: var(--nf-success); }
.nf-state-icon[data-tone='error'] { background: #fef2f2; border: 1px solid rgba(239, 68, 68, 0.32); color: var(--nf-danger); }
.nf-state-icon svg { width: 26px; height: 26px; }
.nf-state-icon .nf-check-draw { stroke-dasharray: 32; stroke-dashoffset: 32; animation: nf-draw-check 460ms cubic-bezier(0.2, 0.8, 0.2, 1) 120ms forwards; }
.nf-state-eyebrow {
  margin: 14px 0 0;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.nf-state-eyebrow[data-tone='success'] { color: var(--nf-success); }
.nf-state-eyebrow[data-tone='error'] { color: var(--nf-danger); }
.nf-state-title {
  margin: 6px 0 0;
  font-size: 16.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
  outline: none;
}
.nf-state-title:focus,
.nf-state-title:focus-visible { outline: none; }
.nf-state-desc {
  max-width: 280px;
  margin: 7px 0 0;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--nf-text-2);
}
.nf-state-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 18px; }
.nf-btn-primary {
  height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 9px;
  background: var(--nf-primary);
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  transition: filter 150ms ease;
}
.nf-btn-primary:hover { filter: brightness(1.07); }
.nf-btn-secondary {
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--nf-line-strong);
  border-radius: 9px;
  background: #fff;
  color: var(--nf-text-2);
  font-size: 12.5px;
  font-weight: 600;
  transition: border-color 150ms ease, background-color 150ms ease, color 150ms ease;
}
.nf-btn-secondary:hover { border-color: #b6bfd0; background: var(--nf-bg-subtle); color: var(--nf-text); }
.nf-state-note { margin: 14px 0 0; font-size: 10.5px; color: var(--nf-text-3); }

/* ---------- animations ---------- */
@keyframes nf-panel-in {
  from { opacity: 0; transform: translateY(10px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes nf-panel-out {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to { opacity: 0; transform: translateY(8px) scale(0.99); }
}
@keyframes nf-state-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes nf-spin { to { transform: rotate(360deg); } }
@keyframes nf-shimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
@keyframes nf-draw-check { to { stroke-dashoffset: 0; } }
@keyframes nf-pulse {
  0%, 100% { box-shadow: 0 8px 24px -8px rgba(var(--nf-primary-rgb), 0.65), 0 2px 6px rgba(15, 23, 42, 0.16); }
  50% { box-shadow: 0 8px 32px -6px rgba(var(--nf-primary-rgb), 0.9), 0 2px 6px rgba(15, 23, 42, 0.16); }
}
.nf-spin { animation: nf-spin 0.9s linear infinite; }

/* ---------- mobile: full-screen sheet ---------- */
@media (max-width: 520px) {
  .nf-root { --nf-space: 14px; }
  .nf-panel {
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    width: auto;
    max-width: none;
    max-height: none;
    height: 100dvh;
    border: none;
    border-radius: 0;
  }
  .nf-panel-header {
    padding-top: calc(16px + env(safe-area-inset-top, 0px));
    border-radius: 0;
  }
  .nf-panel-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  }
  .nf-panel-body > div { flex: 1; display: flex; flex-direction: column; }
  .nf-form { flex: 1; }
  .nf-form-actions { margin-top: auto; padding-top: 10px; }
  .nf-panel-body > .nf-state { flex: 1; justify-content: center; }
  .nf-launcher { bottom: calc(18px + env(safe-area-inset-bottom, 0px)); }
  .nf-tooltip { bottom: calc(74px + env(safe-area-inset-bottom, 0px)); }
  .nf-input,
  .nf-textarea { font-size: 16px; }
  .nf-input { height: 44px; }
  .nf-textarea { min-height: 110px; }
  .nf-chip { height: 38px; padding: 0 14px; font-size: 12.5px; }
  .nf-attach-btn { height: 40px; font-size: 12.5px; }
  .nf-close { width: 36px; height: 36px; }
  .nf-icon-btn { width: 32px; height: 32px; }
  .nf-submit { height: 46px; }
  .nf-btn-primary,
  .nf-btn-secondary { height: 42px; }
}

@media (prefers-reduced-motion: reduce) {
  .nf-root,
  .nf-root *,
  .nf-root *::before,
  .nf-root *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0ms !important;
    transition-duration: 0.01ms !important;
  }
}
`;
