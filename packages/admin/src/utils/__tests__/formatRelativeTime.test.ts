import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import i18n from '@/i18n';
import { formatRelativeTime } from '../formatRelativeTime';

async function useLanguage(language: 'zh' | 'en') {
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
  }
  await i18n.changeLanguage(language);
}

const now = new Date('2026-11-10T04:00:00.000Z');

describe('formatRelativeTime', () => {
  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(async () => {
    await useLanguage('zh');
  });

  it('formats recent timestamps in Chinese', async () => {
    await useLanguage('zh');
    const at = (secondsAgo: number) =>
      new Date(now.getTime() - secondsAgo * 1000).toISOString();

    expect(formatRelativeTime(at(0))).toBe('刚刚');
    expect(formatRelativeTime(at(5 * 60))).toBe('5 分钟前');
    expect(formatRelativeTime(at(3 * 3600))).toBe('3 小时前');
    expect(formatRelativeTime(at(2 * 86400))).toBe('2 天前');
    expect(formatRelativeTime(at(2 * 604800))).toBe('2 周前');
  });

  it('formats recent timestamps in English', async () => {
    await useLanguage('en');
    const at = (secondsAgo: number) =>
      new Date(now.getTime() - secondsAgo * 1000).toISOString();

    expect(formatRelativeTime(at(0))).toBe('just now');
    expect(formatRelativeTime(at(5 * 60))).toBe('5 min ago');
    expect(formatRelativeTime(at(3 * 3600))).toBe('3 h ago');
    expect(formatRelativeTime(at(2 * 86400))).toBe('2 d ago');
    expect(formatRelativeTime(at(2 * 604800))).toBe('2 w ago');
  });
});
