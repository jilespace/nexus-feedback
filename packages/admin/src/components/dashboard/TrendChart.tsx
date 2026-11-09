import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type TrendPoint = { week: string; label: string; count: number };

interface TrendChartProps {
  data: TrendPoint[];
  isDark: boolean;
  tooltipLabel: string;
}

/**
 * Lazy-loaded so the recharts bundle is not part of the initial dashboard chunk.
 */
export default function TrendChart({ data, isDark, tooltipLabel }: TrendChartProps) {
  const axisColor = isDark ? '#64748b' : '#94a3b8';
  const gridColor = isDark ? '#1f2937' : '#eef1f5';
  const tooltipStyle = {
    borderRadius: 10,
    border: `1px solid ${isDark ? '#334155' : '#e5e8ee'}`,
    background: isDark ? '#111827' : '#ffffff',
    boxShadow: '0 8px 24px -12px rgb(15 23 42 / 0.2)',
    fontSize: 12,
    color: isDark ? '#e2e8f0' : '#0f172a',
  } as const;

  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3D5AFE" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#3D5AFE" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={gridColor} strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: axisColor }}
            axisLine={false}
            tickLine={false}
            dy={8}
          />
          <YAxis
            tick={{ fontSize: 11, fill: axisColor }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={40}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ stroke: '#3D5AFE', strokeDasharray: '4 4', strokeOpacity: 0.35 }}
            formatter={(value) => [`${value}`, tooltipLabel]}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#3D5AFE"
            strokeWidth={2.4}
            fill="url(#trendGradient)"
            dot={{ r: 3, strokeWidth: 2, fill: isDark ? '#111827' : '#ffffff' }}
            activeDot={{ r: 5, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
