import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { vote, unvote } from '../api';
import { ArrowUpIcon, SpinnerIcon } from './Icons';

const VOTED_STORAGE_KEY = 'voted_feedback_ids';
const EMAIL_STORAGE_KEY = 'voter_email';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readVotedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(VOTED_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    return new Set();
  }
}

function writeVotedState(feedbackId: string, voted: boolean): void {
  try {
    const ids = readVotedIds();
    if (voted) ids.add(feedbackId);
    else ids.delete(feedbackId);
    localStorage.setItem(VOTED_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* storage may be unavailable */
  }
}

function getStoredEmail(): string | null {
  try {
    return localStorage.getItem(EMAIL_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeEmail(email: string): void {
  try {
    localStorage.setItem(EMAIL_STORAGE_KEY, email);
  } catch {
    /* ignore */
  }
}

interface VoteButtonProps {
  feedbackId: string;
  count: number;
  /** 外部已知投票状态；缺省时从本机记录推断。 */
  voted?: boolean;
  onVoted?: () => void;
}

export function VoteButton({
  feedbackId,
  count,
  voted,
  onVoted,
}: VoteButtonProps) {
  const { t } = useTranslation();
  const [isVoted, setIsVoted] = useState(
    () => voted ?? readVotedIds().has(feedbackId),
  );
  const [voteCount, setVoteCount] = useState(count);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  function flashFailure() {
    setFailed(true);
    window.setTimeout(() => setFailed(false), 2200);
  }

  async function handleVote() {
    if (loading) return;
    let email = getStoredEmail();
    if (!email) {
      const input = window.prompt(t('vote.emailPrompt'));
      if (!input) return;
      email = input.trim();
      if (!EMAIL_PATTERN.test(email)) {
        flashFailure();
        return;
      }
      storeEmail(email);
    }

    setLoading(true);
    try {
      if (isVoted) {
        await unvote(feedbackId, email);
        setVoteCount((current) => Math.max(0, current - 1));
        setIsVoted(false);
        writeVotedState(feedbackId, false);
      } else {
        await vote(feedbackId, email);
        setVoteCount((current) => current + 1);
        setIsVoted(true);
        writeVotedState(feedbackId, true);
      }
      onVoted?.();
    } catch {
      flashFailure();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleVote}
      disabled={loading}
      aria-pressed={isVoted}
      aria-label={
        isVoted
          ? t('vote.ariaLabelVoted', { count: voteCount })
          : t('vote.ariaLabel', { count: voteCount })
      }
      title={isVoted ? t('vote.titleVoted') : t('vote.title')}
      className={[
        'group/vote flex h-[60px] w-[52px] shrink-0 flex-col items-center justify-center gap-1 rounded-pill border transition-all duration-150',
        isVoted
          ? 'border-brand bg-brand text-white shadow-card hover:bg-brand-strong'
          : 'border-line-subtle bg-surface text-ink-secondary hover:border-brand/40 hover:bg-brand-soft/60 hover:text-brand',
        loading ? 'cursor-wait opacity-70' : '',
        failed ? 'ring-1 ring-danger' : '',
      ].join(' ')}
    >
      {loading ? (
        <SpinnerIcon className="h-4 w-4" />
      ) : (
        <ArrowUpIcon className="h-4 w-4 transition-transform duration-150 group-hover/vote:-translate-y-0.5" />
      )}
      <span className="tnum text-14 font-semibold leading-none">{voteCount}</span>
      <span aria-live="polite" className="sr-only">
        {failed ? t('vote.error') : ''}
      </span>
    </button>
  );
}
