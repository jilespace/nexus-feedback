import { useEffect, useState, useCallback } from 'react';

export function useKeyboardShortcuts() {
  const [showHelp, setShowHelp] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase() ?? '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (target?.isContentEditable) return;

    if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setShowHelp((prev) => !prev);
      return;
    }

    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const searchInput = document.querySelector<HTMLInputElement>(
        '[data-shortcut-search]',
      );
      if (searchInput) {
        searchInput.focus();
        return;
      }
    }

    const items = document.querySelectorAll('[data-shortcut-item]');
    if (!items.length) return;

    if (e.key === 'j' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = Math.min(prev + 1, items.length - 1);
        items.forEach((el, i) => {
          el.classList.toggle('ring-2', i === next);
          el.classList.toggle('ring-brand-500', i === next);
        });
        items[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
      return;
    }

    if (e.key === 'k' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = Math.max(prev - 1, 0);
        items.forEach((el, i) => {
          el.classList.toggle('ring-2', i === next);
          el.classList.toggle('ring-brand-500', i === next);
        });
        items[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
      return;
    }

    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      setSelectedIndex((prev) => {
        if (prev >= 0 && prev < items.length) {
          (items[prev] as HTMLElement).click();
        }
        return prev;
      });
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp, selectedIndex };
}
