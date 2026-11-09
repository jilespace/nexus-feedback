import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import type { CSSProperties } from 'react';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { BellIcon } from './NotificationIcons';
import { NotificationPanel } from './NotificationPanel';

type Variant = 'sidebar' | 'mobile';

interface NotificationBellProps {
  variant?: Variant;
}

const SIDEBAR_PANEL_WIDTH = 340;
const PANEL_GAP = 8;
/** Layout's mobile header is h-14, so the mobile panel hangs 8px below it. */
const MOBILE_HEADER_HEIGHT = 56;

function panelPosition(variant: Variant, button: HTMLButtonElement | null): CSSProperties | null {
  if (variant === 'mobile') {
    return {
      top: MOBILE_HEADER_HEIGHT + PANEL_GAP,
      left: 16,
      right: 16,
      maxHeight: 'calc(100vh - 88px)',
    };
  }
  if (!button) return null;

  const rect = button.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  // Anchor beside the sidebar instead of inside it: the panel is portalled, so the
  // sidebar's transform/overflow can never clip it.
  const left = Math.max(
    PANEL_GAP,
    Math.min(rect.right + PANEL_GAP, viewportWidth - SIDEBAR_PANEL_WIDTH - PANEL_GAP),
  );
  const spaceAbove = rect.top - PANEL_GAP - PANEL_GAP;
  const spaceBelow = viewportHeight - rect.bottom - PANEL_GAP - PANEL_GAP;
  const opensUp = spaceAbove >= 280 || spaceAbove >= spaceBelow;
  const maxHeight = Math.max(200, Math.min(520, opensUp ? spaceAbove : spaceBelow));

  return {
    left,
    width: SIDEBAR_PANEL_WIDTH,
    maxHeight,
    ...(opensUp
      ? { bottom: viewportHeight - rect.top + PANEL_GAP }
      : { top: rect.bottom + PANEL_GAP }),
  };
}

export function NotificationBell({ variant = 'sidebar' }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  const { data } = useUnreadNotificationCount();
  const unreadCount = data?.count ?? 0;

  const close = useCallback(() => setOpen(false), []);

  // Fixed coordinates must be measured after layout and kept in sync with resizes.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => setPosition(panelPosition(variant, buttonRef.current));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open, variant]);

  useEffect(() => {
    if (!open) return;

    // Focus moves into the popover so Tab reaches the list; Esc returns it to the bell.
    const frame = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus({ preventScroll: true });
    };
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="通知"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((previous) => !previous)}
        className={clsx(
          'relative flex items-center justify-center rounded-lg text-gray-500 transition-colors',
          'hover:bg-surface-2 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 dark:focus-visible:ring-offset-gray-800',
          variant === 'mobile' ? 'h-9 w-9' : 'h-8 w-8',
          open && 'bg-surface-2 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
        )}
      >
        <BellIcon className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold leading-none tabular-nums text-white ring-2 ring-surface-0 dark:bg-brand-500 dark:ring-gray-800"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      <span className="sr-only" aria-live="polite">
        {unreadCount > 0 ? `${unreadCount} 条未读通知` : '没有未读通知'}
      </span>

      {open && position
        ? createPortal(
            <NotificationPanel
              ref={panelRef}
              id={panelId}
              variant={variant}
              onClose={close}
              style={position}
            />,
            document.body,
          )
        : null}
    </div>
  );
}
