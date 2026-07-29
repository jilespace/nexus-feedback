import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchFeedbackDetail } from '../api';
import type { FeedbackDetail as FeedbackDetailType } from '../types';
import { VoteButton } from '../components/VoteButton';
import { CommentForm } from '../components/CommentForm';

interface FeedbackDetailProps {
  feedbackId?: string;
  onBack?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  open: '待处理',
  in_progress: '进行中',
  resolved: '已完成',
  closed: '已关闭',
};

const CATEGORY_LABELS: Record<string, string> = {
  feature: '功能建议',
  bug: 'Bug',
  improvement: '改进',
  other: '其他',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function FeedbackDetail({ feedbackId: propId, onBack }: FeedbackDetailProps = {}) {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const feedbackId = propId || params.id || '';
  const handleBack = onBack || (() => navigate('..'));
  const [data, setData] = useState<FeedbackDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function loadData() {
    setLoading(true);
    fetchFeedbackDetail(feedbackId)
      .then(setData)
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, [feedbackId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-sm text-gray-400">
        加载中...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-sm text-red-500">
        {error || '未找到'}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <button
        type="button"
        onClick={handleBack}
        className="mb-4 flex items-center gap-1 text-sm text-gray-500 transition hover:text-gray-700"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        返回
      </button>

      <div className="animate-fade-in rounded-xl border border-surface-3 bg-surface-0 p-6">
        <div className="mb-4 flex items-start gap-4">
          <VoteButton feedbackId={data.id} count={data.vote_count} onVoted={loadData} />
          <div className="min-w-0 flex-1">
            <h1 className="mb-2 text-lg font-semibold text-gray-900">{data.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">
                {CATEGORY_LABELS[data.category] || data.category}
              </span>
              {data.status && (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-gray-500">
                  {STATUS_LABELS[data.status] || data.status}
                </span>
              )}
              <span className="text-xs text-gray-400">{formatDate(data.created_at)}</span>
            </div>
          </div>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
          {data.content}
        </p>
        {data.tags && data.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1">
            {data.tags.map((tag) => (
              <span key={tag} className="rounded bg-surface-2 px-2 py-0.5 text-xs text-gray-500">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        {data.replies && data.replies.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">
              官方回复 ({data.replies.length})
            </h2>
            <div className="space-y-3">
              {data.replies.map((reply) => (
                <div
                  key={reply.id}
                  className="rounded-lg border border-brand-100 bg-brand-50/50 p-4"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                      团队回复
                    </span>
                    {reply.member && (
                      <span className="text-xs text-gray-500">{reply.member.display_name}</span>
                    )}
                    <span className="text-xs text-gray-400">
                      {formatDate(reply.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{reply.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <h2 className="mb-4 text-sm font-semibold text-gray-900">
          评论 ({data.comments.length})
        </h2>
        {data.comments.length === 0 && (
          <p className="mb-4 text-sm text-gray-400">暂无评论</p>
        )}
        <div className="mb-6 space-y-3">
          {data.comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-lg border border-surface-3 bg-surface-0 p-4"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">
                  {comment.name || comment.email.split('@')[0]}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDate(comment.created_at)}
                </span>
              </div>
              <p className="text-sm text-gray-600">{comment.content}</p>
            </div>
          ))}
        </div>
        <CommentForm feedbackId={feedbackId} onCommented={loadData} />
      </div>
    </div>
  );
}
