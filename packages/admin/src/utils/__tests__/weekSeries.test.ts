import { describe, it, expect } from 'vitest';
import { fillLastWeeks, isoWeekKey } from '../weekSeries';

describe('weekSeries', () => {
  it('computes ISO week keys in UTC', () => {
    expect(isoWeekKey(new Date(Date.UTC(2026, 0, 1)))).toBe('2026-W01');
    expect(isoWeekKey(new Date(Date.UTC(2026, 10, 10)))).toBe('2026-W46');
    // A Monday belongs to the week it starts.
    expect(isoWeekKey(new Date(Date.UTC(2026, 10, 9)))).toBe('2026-W46');
    // Sunday belongs to the week that started six days earlier.
    expect(isoWeekKey(new Date(Date.UTC(2026, 10, 8)))).toBe('2026-W45');
  });

  it('fills missing weeks with zero instead of dropping them', () => {
    const now = new Date(Date.UTC(2026, 10, 10));
    const series = fillLastWeeks([{ week: '2026-W46', count: 5 }], 4, now);
    expect(series).toHaveLength(4);
    expect(series.map((point) => point.week)).toEqual([
      '2026-W43',
      '2026-W44',
      '2026-W45',
      '2026-W46',
    ]);
    expect(series[3]!.count).toBe(5);
    expect(series[0]!.count).toBe(0);
    expect(series[3]!.label).toBe('W46');
  });

  it('keeps the provided order and ignores unknown weeks', () => {
    const now = new Date(Date.UTC(2026, 0, 15));
    const series = fillLastWeeks([{ week: '1999-W01', count: 9 }], 2, now);
    expect(series).toHaveLength(2);
    expect(series.every((point) => point.count === 0)).toBe(true);
  });
});
