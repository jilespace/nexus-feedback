import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { canonicalUrl } from '../lib/meta';
import { CheckIcon, ShareIcon } from './Icons';

type ShareStatus = 'idle' | 'copied' | 'error';

/** Clipboard API first, legacy selection fallback for non-secure origins. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to execCommand */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

interface ShareButtonProps {
  /** Route path shared as the canonical URL, e.g. `/demo-project`. */
  path: string;
  title: string;
  ariaLabel: string;
}

export function ShareButton({ path, title, ariaLabel }: ShareButtonProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ShareStatus>('idle');
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(resetTimer.current);
    },
    [],
  );

  function scheduleReset() {
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setStatus('idle'), 2400);
  }

  async function handleShare() {
    const url = canonicalUrl(path);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        /* Native share unavailable in this context: fall back to copying. */
      }
    }
    const copied = await copyText(url);
    setStatus(copied ? 'copied' : 'error');
    scheduleReset();
  }

  const label =
    status === 'copied'
      ? t('share.copied')
      : status === 'error'
        ? t('share.error')
        : t('share.action');

  return (
    <span className="inline-flex shrink-0">
      <button
        type="button"
        onClick={() => void handleShare()}
        className="btn-secondary btn-sm"
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        {status === 'copied' ? (
          <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ShareIcon className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {label}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {status === 'copied'
          ? t('share.copiedAnnouncement')
          : status === 'error'
            ? t('share.errorAnnouncement')
            : ''}
      </span>
    </span>
  );
}
