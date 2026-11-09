import type { ChangelogEntry, FeedbackDetail } from '../types';

const COMMENT_ACTION = 'https://schema.org/CommentAction';
const LIKE_ACTION = 'https://schema.org/LikeAction';

/**
 * Public feedback detail → DiscussionForumPosting.
 * Only fields the public API actually returns are used: the submitter is not
 * exposed publicly, so `author` is intentionally omitted.
 */
export function buildFeedbackJsonLd(
  feedback: FeedbackDetail,
  url: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    headline: feedback.title,
    text: feedback.content,
    url,
    datePublished: feedback.created_at,
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: COMMENT_ACTION,
        userInteractionCount: feedback.comments.length,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: LIKE_ACTION,
        userInteractionCount: feedback.vote_count,
      },
    ],
  };
}

interface ChangelogJsonLdOptions {
  name: string;
  description: string;
  url: string;
  language: string;
}

/** Changelog list → Blog with its published posts (no per-entry route exists). */
export function buildChangelogJsonLd(
  entries: ChangelogEntry[],
  options: ChangelogJsonLdOptions,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: options.name,
    description: options.description,
    url: options.url,
    inLanguage: options.language,
    blogPost: entries.slice(0, 10).map((entry) => ({
      '@type': 'BlogPosting',
      headline: entry.title,
      datePublished: entry.published_at,
    })),
  };
}
