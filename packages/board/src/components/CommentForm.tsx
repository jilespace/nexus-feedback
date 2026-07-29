import { useState } from 'react';
import { postComment } from '../api';

interface CommentFormProps {
  feedbackId: string;
  onCommented: () => void;
}

export function CommentForm({ feedbackId, onCommented }: CommentFormProps) {
  const [email, setEmail] = useState(
    () => localStorage.getItem('voter_email') || '',
  );
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !content.trim()) {
      setError('请填写邮箱和评论内容');
      return;
    }
    setLoading(true);
    setError('');
    try {
      localStorage.setItem('voter_email', email);
      await postComment(feedbackId, {
        email,
        name: name || undefined,
        content,
      });
      setContent('');
      onCommented();
    } catch {
      setError('评论失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="邮箱 *"
          className="flex-1 rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="昵称（可选）"
          className="flex-1 rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="写下您的评论..."
        className="w-full resize-none rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? '提交中...' : '发表评论'}
        </button>
      </div>
    </form>
  );
}
