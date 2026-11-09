const RSS_LABELS = {
  zh: {
    action: 'RSS 订阅',
    ariaLabel: 'RSS 订阅（新窗口打开）',
  },
  en: {
    action: 'RSS feed',
    ariaLabel: 'RSS feed (opens in a new tab)',
  },
} as const;

/** Same-origin public API path, matching src/api.ts assumptions. */
export function changelogFeedPath(projectSlug: string | undefined): string {
  return `/api/v1/public/${projectSlug ?? 'default'}/changelog.rss`;
}

export function changelogRssLabel(language: string): {
  action: string;
  ariaLabel: string;
} {
  return language.startsWith('zh') ? RSS_LABELS.zh : RSS_LABELS.en;
}
