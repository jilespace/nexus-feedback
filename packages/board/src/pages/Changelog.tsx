import { useEffect, useState } from 'react';
import { fetchChangelog } from '../api';
import type { ChangelogEntry } from '../types';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function Changelog() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchChangelog()
      .then(setEntries)
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">加载中...</div>
    );
  }
  if (error) {
    return (
      <div className="py-12 text-center text-sm text-red-500">{error}</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-lg font-semibold text-gray-900">更新日志</h1>
      {entries.length === 0 && (
        <p className="py-12 text-center text-sm text-gray-400">暂无更新</p>
      )}
      <div className="relative border-l-2 border-surface-3 pl-6">
        {entries.map((entry, i) => (
          <div
            key={entry.id}
            className="animate-fade-in relative mb-8 last:mb-0"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-brand-400 bg-surface-0" />
            <time className="mb-1 block text-xs font-medium text-gray-400">
              {formatDate(entry.published_at)}
            </time>
            <h2 className="mb-2 text-base font-semibold text-gray-900">
              {entry.title}
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
              {entry.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
