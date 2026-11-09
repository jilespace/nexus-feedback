import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { FeedbackItem } from '../types';
import { timeAgo } from '../lib/labels';
import { CategoryPill, StatusBadge, TagPill } from './Badges';
import { ChevronRightIcon, MessageIcon } from './Icons';
import { VoteButton } from './VoteButton';

interface FeedbackCardProps {
  item: FeedbackItem;
  to: string;
  index?: number;
}

export function FeedbackCard({ item, to, index = 0 }: FeedbackCardProps) {
  const { t, i18n } = useTranslation();
  const tags = (item.tags ?? []).slice(0, 2);

  return (
    <article
      className="card group relative flex animate-rise gap-3 p-3.5 transition-[box-shadow,border-color] duration-150 hover:border-line-strong hover:shadow-lift sm:gap-4 sm:p-4"
      style={index < 10 ? { animationDelay: `${index * 35}ms` } : undefined}
      aria-labelledby={`feedback-${item.id}-title`}
    >
      <VoteButton feedbackId={item.id} count={item.vote_count} />
      <Link
        to={to}
        className="flex min-w-0 flex-1 items-start gap-2 rounded-control"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2.5">
            <h2
              id={`feedback-${item.id}-title`}
              className="line-clamp-2 min-w-0 flex-1 text-14 font-semibold leading-snug text-ink transition-colors duration-150 group-hover:text-brand"
            >
              {item.title}
            </h2>
            <StatusBadge status={item.status} className="mt-px shrink-0" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-11 text-ink-tertiary">
            <CategoryPill category={item.category} />
            {tags.map((tag) => (
              <TagPill key={tag.id} tag={tag} />
            ))}
            {typeof item.comment_count === 'number' && (
              <span className="inline-flex items-center gap-1">
                <MessageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="tnum">{item.comment_count}</span>
                <span className="sr-only">{t('common.commentCount')}</span>
              </span>
            )}
            <time dateTime={item.created_at}>
              {timeAgo(t, item.created_at, i18n.language)}
            </time>
          </div>
        </div>
        <ChevronRightIcon className="mt-0.5 hidden h-4 w-4 shrink-0 text-ink-tertiary/60 transition-colors duration-150 group-hover:text-brand sm:block" />
      </Link>
    </article>
  );
}
