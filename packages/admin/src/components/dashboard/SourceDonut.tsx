import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export type SourceSlice = { name: string; value: number; color: string; pct: number };

interface SourceDonutProps {
  sources: SourceSlice[];
  total: number;
  totalLabel: string;
  isDark: boolean;
}

/**
 * Lazy-loaded so the recharts bundle is not part of the initial dashboard chunk.
 */
export default function SourceDonut({ sources, total, totalLabel, isDark }: SourceDonutProps) {
  const tooltipStyle = {
    borderRadius: 10,
    border: `1px solid ${isDark ? '#334155' : '#e5e8ee'}`,
    background: isDark ? '#111827' : '#ffffff',
    boxShadow: '0 8px 24px -12px rgb(15 23 42 / 0.2)',
    fontSize: 12,
    color: isDark ? '#e2e8f0' : '#0f172a',
  } as const;

  return (
    <div className="relative mx-auto h-[168px] w-full max-w-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={sources}
            dataKey="value"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={3}
            strokeWidth={0}
          >
            {sources.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">
          {total}
        </span>
        <span className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">{totalLabel}</span>
      </div>
    </div>
  );
}
