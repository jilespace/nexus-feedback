import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render errors so a broken page never leaves the workspace blank.
 * Users can recover by reloading without losing their session.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-surface-3 bg-surface-0 p-6 text-center shadow-card dark:border-gray-700 dark:bg-gray-800">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 8v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="12" cy="16.5" r="1" fill="currentColor" />
              <path
                d="M10.6 4.2 3.4 17a1.6 1.6 0 0 0 1.4 2.4h14.4a1.6 1.6 0 0 0 1.4-2.4L13.4 4.2a1.6 1.6 0 0 0-2.8 0Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-50">
            页面出现了异常
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
            你的登录状态与数据不会丢失。可以先重试，若持续出现请反馈给我们。
          </p>
          <p className="mt-3 truncate rounded-lg bg-surface-1 px-3 py-2 font-mono text-[11px] text-gray-400 dark:bg-gray-900/40 dark:text-gray-500">
            {error.message}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              onClick={this.reset}
              className="h-9 rounded-lg border border-surface-3 bg-surface-0 px-4 text-[13px] font-medium text-gray-600 transition-colors hover:bg-surface-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              重试
            </button>
            <button
              onClick={() => window.location.reload()}
              className="h-9 rounded-lg bg-brand-600 px-4 text-[13px] font-medium text-white transition-colors hover:bg-brand-700"
            >
              刷新页面
            </button>
          </div>
        </div>
      </div>
    );
  }
}
