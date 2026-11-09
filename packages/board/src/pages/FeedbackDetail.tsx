import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchFeedbackDetail } from '../api';
import type { FeedbackDetail as FeedbackDetailType } from '../types';
import { formatDateTime, sourceLabel } from '../lib/labels';
import { VoteButton } from '../components/VoteButton';
import { CommentForm } from '../components/CommentForm';
import {
  CategoryPill,
  CountBadge,
  MetaDot,
  StatusBadge,
  TagPill,
} from '../components/Badges';
import { ChevronLeftIcon, MessageIcon } from '../components/Icons';
import { DetailSkeleton, ErrorState } from '../components/States';

export function FeedbackDetail() {
  const { t, i18n } = useTranslation();
  const { projectSlug, id } = useParams<{ projectSlug: string; id: string }>();
  const base = `/${projectSlug ?? ''}`;
  const [data, setData] = useState<FeedbackDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) {
      setError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      setData(await fetchFeedbackDetail(id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const backLink = (
    <Link
      to={base}
      className="mb-4 inline-flex items-center gap-1 text-12 font-medium text-ink-secondary transition-colors duration-150 hover:text-ink"
    >
      <ChevronLeftIcon className="h-3.5 w-3.5" aria-hidden="true" />
      {t('detail.back')}
    </Link>
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        {backLink}
        <DetailSkeleton label={t('common.loading')} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        {backLink}
        <ErrorState
          title={t('detail.notFoundTitle')}
          description={t('detail.notFoundDescription')}
          retryLabel={t('common.retry')}
          onRetry={() => void loadData()}
        />
      </div>
    );
  }

  const replies = data.replies ?? [];
  const comments = data.comments;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      {backLink}

      <article className="card p-4 sm:p-6">
        <div className="flex gap-3.5 sm:gap-4">
          <VoteButton
            feedbackId={data.id}
            count={data.vote_count}
            onVoted={() => void loadData()}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={data.status} />
              <CategoryPill category={data.category} />
              {data.source && (
                <span className="text-11 text-ink-tertiary">
                  {t('source.prefix', {
                    value: sourceLabel(t, data.source),
                  })}
                </span>
              )}
            </div>
            <h1 className="mt-2.5 text-18 font-semibold leading-snug text-ink sm:text-22">
              {data.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-11 text-ink-tertiary">
              <time dateTime={data.created_at}>
                {formatDateTime(data.created_at, i18n.language)}
              </time>
              <MetaDot />
              <span className="inline-flex items-center gap-1">
                <MessageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="tnum">{comments.length}</span>
                <span>{t('common.comments')}</span>
              </span>
            </div>
            {data.tags && data.tags.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {data.tags.map((tag) => (
                  <TagPill key={tag.id} tag={tag} />
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 border-t border-line-subtle pt-4">
          <p className="whitespace-pre-wrap break-words text-14 leading-relaxed text-ink-secondary">
            {data.content}
          </p>
        </div>
      </article>

      {replies.length > 0 && (
        <section className="mt-5" aria-labelledby="detail-replies-title">
          <h2
            id="detail-replies-title"
            className="mb-3 flex items-center gap-2 text-14 font-semibold text-ink"
          >
            {t('detail.officialReplies')}
            <CountBadge>{replies.length}</CountBadge>
          </h2>
          <div className="space-y-3">
            {replies.map((reply) => (
              <div
                key={reply.id}
                className="rounded-card border border-brand/20 bg-brand-soft/50 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-md bg-brand px-1.5 py-0.5 text-11 font-semibold text-white">
                    {t('detail.teamReply')}
                  </span>
                  {reply.member && (
                    <span className="text-12 font-medium text-ink">
                      {reply.member.display_name}
                    </span>
                  )}
                  <span className="text-11 text-ink-tertiary">
                    {formatDateTime(reply.created_at, i18n.language)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-13 leading-relaxed text-ink-secondary">
                  {reply.content}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-5" aria-labelledby="detail-comments-title">
        <h2
          id="detail-comments-title"
          className="mb-3 flex items-center gap-2 text-14 font-semibold text-ink"
        >
          {t('detail.comments')}
          <CountBadge>{comments.length}</CountBadge>
        </h2>
        {comments.length === 0 ? (
          <p className="rounded-card border border-dashed border-line-strong/60 px-4 py-8 text-center text-13 text-ink-tertiary">
            {t('detail.noComments')}
          </p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => {
              const author = comment.author_name || t('detail.anonymous');
              return (
                <div key={comment.id} className="card p-4">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-subtle bg-surface-subtle text-12 font-semibold text-ink-secondary"
                      aria-hidden="true"
                    >
                      {author.trim().charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-12 font-medium text-ink">
                        {author}
                      </p>
                      <p className="text-11 text-ink-tertiary">
                        {formatDateTime(comment.created_at, i18n.language)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2.5 whitespace-pre-wrap break-words text-13 leading-relaxed text-ink-secondary">
                    {comment.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-5">
        <CommentForm
          feedbackId={data.id}
          onCommented={() => void loadData()}
        />
      </div>
    </div>
  );
}
