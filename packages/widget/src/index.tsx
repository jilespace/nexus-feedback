import React from 'react';
import ReactDOM from 'react-dom/client';
import { FeedbackWidget } from './FeedbackWidget';
import type { Locale } from './i18n';

export type WidgetConfig = {
  apiKey: string;
  apiUrl: string;
  position?: 'bottom-right' | 'bottom-left';
  theme?: {
    primaryColor?: string;
    buttonLabel?: string;
  };
  locale?: Locale;
};

export { FeedbackWidget };

export function mount(el: HTMLElement, config: WidgetConfig) {
  const root = ReactDOM.createRoot(el);
  root.render(<FeedbackWidget {...config} />);
  return () => root.unmount();
}

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).NexusFeedbackWidget = { mount, FeedbackWidget };
}
