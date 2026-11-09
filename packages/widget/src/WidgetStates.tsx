import type { RefObject } from 'react';
import { t, Locale } from './i18n';
import { AlertIcon, CheckIcon, XCircleIcon } from './icons';

type SuccessStateProps = {
  title: string;
  message: string;
  locale: Locale;
  titleRef: RefObject<HTMLHeadingElement>;
  onDone: () => void;
  onAgain: () => void;
};

export function SuccessState({ title, message, locale, titleRef, onDone, onAgain }: SuccessStateProps) {
  return (
    <div className="nf-state" role="status" aria-live="polite">
      <span className="nf-state-icon" data-tone="success">
        <CheckIcon className="nf-check-draw" />
      </span>
      <p className="nf-state-eyebrow" data-tone="success">
        {t(locale, 'submitted')}
      </p>
      <h3 className="nf-state-title" ref={titleRef} tabIndex={-1}>
        {title}
      </h3>
      <p className="nf-state-desc">{message}</p>
      <div className="nf-state-actions">
        <button type="button" className="nf-btn-primary" onClick={onDone}>
          {t(locale, 'done')}
        </button>
        <button type="button" className="nf-btn-secondary" onClick={onAgain}>
          {t(locale, 'again')}
        </button>
      </div>
      <p className="nf-state-note">{t(locale, 'submitHint')}</p>
    </div>
  );
}

type ErrorStateProps = {
  message: string;
  locale: Locale;
  titleRef: RefObject<HTMLHeadingElement>;
  onBack: () => void;
  onClose: () => void;
};

export function ErrorState({ message, locale, titleRef, onBack, onClose }: ErrorStateProps) {
  return (
    <div className="nf-state" role="alert">
      <span className="nf-state-icon" data-tone="error">
        <XCircleIcon />
      </span>
      <p className="nf-state-eyebrow" data-tone="error">
        {t(locale, 'submitFailed')}
      </p>
      <h3 className="nf-state-title" ref={titleRef} tabIndex={-1}>
        {message}
      </h3>
      <p className="nf-state-desc">{t(locale, 'errorNote')}</p>
      <div className="nf-state-actions">
        <button type="button" className="nf-btn-primary" onClick={onBack}>
          {t(locale, 'retry')}
        </button>
        <button type="button" className="nf-btn-secondary" onClick={onClose}>
          {t(locale, 'close')}
        </button>
      </div>
      <p className="nf-state-note">
        <AlertIcon style={{ display: 'inline', width: 11, height: 11, verticalAlign: '-1px' }} />{' '}
        {t(locale, 'errorSupport')}
      </p>
    </div>
  );
}
