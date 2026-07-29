import { useState } from 'react';
import { vote, unvote } from '../api';

interface VoteButtonProps {
  feedbackId: string;
  count: number;
  voted?: boolean;
  onVoted?: () => void;
}

function getStoredEmail(): string | null {
  return localStorage.getItem('voter_email');
}

function storeEmail(email: string): void {
  localStorage.setItem('voter_email', email);
}

export function VoteButton({ feedbackId, count, voted = false, onVoted }: VoteButtonProps) {
  const [isVoted, setIsVoted] = useState(voted);
  const [voteCount, setVoteCount] = useState(count);
  const [loading, setLoading] = useState(false);

  async function handleVote() {
    let email = getStoredEmail();
    if (!email) {
      email = window.prompt('请输入您的邮箱以投票：\n（邮箱仅用于标识投票身份，不会公开显示）');
      if (!email) return;
      storeEmail(email);
    }

    setLoading(true);
    try {
      if (isVoted) {
        await unvote(feedbackId, email);
        setVoteCount((c) => c - 1);
        setIsVoted(false);
      } else {
        await vote(feedbackId, email);
        setVoteCount((c) => c + 1);
        setIsVoted(true);
      }
      onVoted?.();
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleVote}
      disabled={loading}
      className={`
        flex flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2
        text-sm font-semibold transition-all duration-200
        ${isVoted
          ? 'border-brand-200 bg-brand-50 text-brand-600 shadow-sm'
          : 'border-surface-3 bg-surface-0 text-gray-500 hover:border-brand-200 hover:text-brand-600'
        }
        ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className={`transition-transform duration-200 ${isVoted ? 'scale-110' : ''}`}
      >
        <path
          d="M8 3L12 9H4L8 3Z"
          fill="currentColor"
        />
      </svg>
      <span>{voteCount}</span>
    </button>
  );
}
