/**
 * ISO week helpers used by the dashboard trend chart so weeks without feedback
 * render as zero instead of disappearing from the axis. Keys are computed in
 * UTC to match the API's aggregation and stay stable across time zones.
 */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function fillLastWeeks(
  points: Array<{ week: string; count: number }>,
  count = 8,
  now = new Date(),
): Array<{ week: string; label: string; count: number }> {
  const byWeek = new Map(points.map((p) => [p.week, p.count]));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const result: Array<{ week: string; label: string; count: number }> = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const key = isoWeekKey(d);
    result.push({ week: key, label: key.replace(/^\d{4}-W/, 'W'), count: byWeek.get(key) ?? 0 });
  }
  return result;
}
