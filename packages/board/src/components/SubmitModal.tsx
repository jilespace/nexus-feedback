import { useState, useEffect } from 'react';
import { submitFeedback, fetchProjectCategories, ProjectCategory } from '../api';

interface SubmitModalProps {
  onClose: () => void;
  onSubmitted: () => void;
}

export function SubmitModal({ onClose, onSubmitted }: SubmitModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('feature');
  const [email, setEmail] = useState(
    () => localStorage.getItem('voter_email') || '',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [categories, setCategories] = useState<ProjectCategory[]>([]);

  useEffect(() => {
    fetchProjectCategories().then(setCategories);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !email.trim()) {
      setError('请填写所有必填字段');
      return;
    }
    setLoading(true);
    setError('');
    try {
      localStorage.setItem('voter_email', email);
      await submitFeedback({ title, content, category, email });
      setSuccess(true);
      onSubmitted();
      setTimeout(() => onClose(), 1500);
    } catch {
      setError('提交失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="animate-slide-up w-full max-w-lg rounded-xl bg-surface-0 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900">提交反馈</h2>
        {success && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            <span>✓</span> 反馈提交成功，感谢您的参与！
          </div>
        )}
        {error && (
          <p className="mb-3 text-sm text-red-600">{error}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              邮箱 <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              placeholder="简要描述您的反馈"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              分类
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              {categories.length > 0 ? (
                categories.map(cat => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="feature">功能建议</option>
                  <option value="bug">Bug 报告</option>
                  <option value="improvement">改进</option>
                  <option value="other">其他</option>
                </>
              )}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              详细描述 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              placeholder="详细描述您的反馈内容..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-surface-3 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-surface-2"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? '提交中...' : '提交'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
