import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; type: ToastType };
type ToastContextType = { show: (message: string, type?: ToastType) => void };

const ToastContext = createContext<ToastContextType | null>(null);
let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++;
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const TONES: Record<
  ToastType,
  { icon: ReactNode; wrap: string }
> = {
  success: {
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="m3.5 8.4 2.8 2.8 6-6.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    wrap: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  error: {
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="m5 5 6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    wrap: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  },
  info: {
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 7.2v3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="5" r="0.8" fill="currentColor" />
      </svg>
    ),
    wrap: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const { t } = useTranslation();
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3200);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const tone = TONES[toast.type];

  return (
    <div
      role="status"
      className={clsx(
        'pointer-events-auto flex w-full max-w-sm animate-slide-in-right items-center gap-2.5 rounded-xl border border-surface-3 bg-surface-0 px-3.5 py-2.5 shadow-pop',
        'dark:border-gray-700 dark:bg-gray-800',
      )}
    >
      <span
        className={clsx(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          tone.wrap,
        )}
      >
        {tone.icon}
      </span>
      <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-gray-800 dark:text-gray-100">
        {toast.message}
      </p>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label={t('common.close')}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-300 transition-colors hover:bg-surface-2 hover:text-gray-500 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
          <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
