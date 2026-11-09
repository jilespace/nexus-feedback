import { useCallback, useEffect, type RefObject } from 'react';

function getDeepActiveElement(): Element | null {
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  const selector =
    'button:not([disabled]),[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (element) => element.getClientRects().length > 0,
  );
}

/**
 * 弹窗焦点管理：打开时聚焦首个可交互元素，Tab 循环，Esc 关闭，关闭后恢复焦点。
 */
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  restoreFocusRef?: RefObject<HTMLElement | null>,
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const container = containerRef.current;
      if (!container) return;
      const focusable = getFocusable(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const current = getDeepActiveElement();
      const inside = current ? container.contains(current) : false;

      if (event.shiftKey) {
        if (!inside || current === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!inside || current === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [containerRef, onClose],
  );

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previous = getDeepActiveElement() as HTMLElement | null;
    const initial =
      container.querySelector<HTMLElement>('[data-autofocus="true"]') ?? getFocusable(container)[0] ?? container;
    initial.focus();

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      const target = restoreFocusRef?.current ?? previous;
      target?.focus?.();
    };
  }, [active, containerRef, handleKeyDown, restoreFocusRef]);
}
