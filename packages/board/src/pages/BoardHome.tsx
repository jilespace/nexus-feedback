import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFeedbackList } from '../api';
import type { FeedbackItem } from '../types';
import { VoteButton } from '../components/VoteButton';
import { SubmitModal } from '../components/SubmitModal';

function debounce(fn: (value: string) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (value: string) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(value), ms);
  };
}

interface BoardHomeProps {
  onNavigate?: (path: string) => void;
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

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

export function BoardHome(_props: BoardHomeProps = {}) {
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<'votes' | 'created_at'>('votes');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [showModal, setShowModal] = useState(false);

  const debouncedSearch = debounce((value: string) => {
    setDebouncedKeyword(value);
  }, 300);

  function handleKeywordChange(value: string) {
    setKeyword(value);
    debouncedSearch(value);
  }

  function loadData() {
    setLoading(true);
    setError('');
    fetchFeedbackList({
      sort_by: sortBy,
      status: statusFilter || undefined,
      category: categoryFilter || undefined,
      keyword: debouncedKeyword || undefined,
    })
      .then((res) => setItems(res.items))
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, [sortBy, statusFilter, categoryFilter, debouncedKeyword]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => setSortBy('votes')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              sortBy === 'votes'
                ? 'bg-surface-0 text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            最热
          </button>
          <button
            type="button"
            onClick={() => setSortBy('created_at')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              sortBy === 'created_at'
                ? 'bg-surface-0 text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            最新
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
        >
          提交反馈
        </button>
      </div>

      <div className="mb-4 flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-1.5 text-sm outline-none"
        >
          <option value="">全部状态</option>
          <option value="open">待处理</option>
          <option value="in_progress">进行中</option>
          <option value="resolved">已完成</option>
          <option value="closed">已关闭</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-1.5 text-sm outline-none"
        >
          <option value="">全部分类</option>
          <option value="feature">功能建议</option>
          <option value="bug">Bug</option>
          <option value="improvement">改进</option>
          <option value="other">其他</option>
        </select>
        <input
          value={keyword}
          onChange={(e) => handleKeywordChange(e.target.value)}
          placeholder="搜索反馈..."
          className="flex-1 rounded-lg border border-surface-3 bg-surface-0 px-3 py-1.5 text-sm outline-none focus:border-brand-400"
        />
      </div>

      {loading && (
        <div className="py-12 text-center text-sm text-gray-400">加载中...</div>
      )}
      {error && (
        <div className="py-12 text-center text-sm text-red-500">{error}</div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-400">
          暂无反馈，来提交第一条吧
        </div>
      )}

      <div className="space-y-3">
        {items.map((item, i) => (
          <div
            key={item.id}
            className="animate-fade-in flex gap-4 rounded-xl border border-surface-3 bg-surface-0 p-4 transition hover:shadow-md"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <VoteButton feedbackId={item.id} count={item.vote_count} />
            <div
              className="min-w-0 flex-1 cursor-pointer"
              onClick={() => navigate(`feedback/${item.id}`)}
            >
              <h3 className="mb-1 text-sm font-semibold text-gray-900 line-clamp-1">
                {item.title}
              </h3>
              <p className="mb-2 text-xs text-gray-500 line-clamp-2">
                {item.content}
              </p>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">
                  {CATEGORY_LABELS[item.category] || item.category}
                </span>
                {item.status && (
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-gray-500">
                    {STATUS_LABELS[item.status] || item.status}
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {item.comment_count} 评论
                </span>
                <span className="text-xs text-gray-400">
                  {timeAgo(item.created_at)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <SubmitModal
          onClose={() => setShowModal(false)}
          onSubmitted={loadData}
        />
      )}
    </div>
  );
}
