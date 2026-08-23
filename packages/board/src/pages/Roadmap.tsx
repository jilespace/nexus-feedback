import { useEffect, useState } from 'react';
import { fetchRoadmap } from '../api';
import type { FeedbackItem, RoadmapColumn, RoadmapData } from '../types';

const COLUMN_CONFIG = [
  { key: 'planned' as const, label: '计划中', color: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400' },
  { key: 'in_progress' as const, label: '进行中', color: 'bg-blue-50 border-blue-200', dot: 'bg-blue-400' },
  { key: 'completed' as const, label: '已完成', color: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-400' },
] as const;

function RoadmapCard({ item }: { item: FeedbackItem }) {
  return (
    <div className="rounded-lg border border-surface-3 bg-surface-0 p-3 transition hover:shadow-sm">
      <h4 className="mb-1 text-sm font-medium text-gray-900 line-clamp-2">
        {item.title}
      </h4>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-600">
          {item.category}
        </span>
        <span className="text-xs text-gray-400">
          {item.vote_count} 票
        </span>
      </div>
    </div>
  );
}

function CustomColumns({ columns }: { columns: RoadmapColumn[] }) {
  return (
    <div
      className="grid gap-6"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
    >
      {columns.map((col) => (
        <div key={col.key} className="rounded-xl border border-surface-3 bg-surface-1 p-4">
          <div className="mb-4 flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: col.color }}
            />
            <h2 className="text-sm font-semibold text-gray-800">{col.name}</h2>
            <span className="ml-auto text-xs text-gray-500">{col.items.length}</span>
          </div>
          <div className="space-y-2">
            {col.items.map((item) => (
              <RoadmapCard key={item.id} item={item} />
            ))}
            {col.items.length === 0 && (
              <p className="py-4 text-center text-xs text-gray-400">暂无</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Roadmap() {
  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRoadmap()
      .then(setData)
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">加载中...</div>
    );
  }
  if (error || !data) {
    return (
      <div className="py-12 text-center text-sm text-red-500">{error}</div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-6 text-lg font-semibold text-gray-900">产品路线图</h1>
      {data.columns?.length ? (
        <CustomColumns columns={data.columns} />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {COLUMN_CONFIG.map((col) => (
            <div key={col.key} className={`rounded-xl border p-4 ${col.color}`}>
              <div className="mb-4 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                <h2 className="text-sm font-semibold text-gray-800">
                  {col.label}
                </h2>
                <span className="ml-auto text-xs text-gray-500">
                  {data[col.key]?.length ?? 0}
                </span>
              </div>
              <div className="space-y-2">
                {(data[col.key] ?? []).map((item) => (
                  <RoadmapCard key={item.id} item={item} />
                ))}
                {(data[col.key]?.length ?? 0) === 0 && (
                  <p className="py-4 text-center text-xs text-gray-400">暂无</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
