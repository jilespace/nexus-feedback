import { useEffect } from 'react';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
};

export function Modal({ title, description, onClose, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-gray-950/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          'relative z-10 flex max-h-[90vh] w-full animate-fade-up flex-col rounded-t-2xl border border-surface-3 bg-surface-0 shadow-pop',
          'dark:border-gray-700 dark:bg-gray-800 sm:rounded-2xl',
          SIZES[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-1 pt-5">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">{title}</h3>
            {description && (
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-surface-2 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-surface-2 px-5 py-3 dark:border-gray-700/60">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
