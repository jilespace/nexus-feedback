import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';

// Adds .lp-reveal-in to [data-reveal] nodes once they scroll into view.

export function useScrollReveal(rootRef: RefObject<HTMLDivElement>) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) return;

    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    const pending = nodes.filter((node) => node.getBoundingClientRect().top > window.innerHeight);
    for (const node of pending) node.classList.add('lp-reveal-pending');
    if (!pending.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('lp-reveal-in');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.05 },
    );
    for (const node of pending) observer.observe(node);
    return () => observer.disconnect();
  }, [rootRef]);
}