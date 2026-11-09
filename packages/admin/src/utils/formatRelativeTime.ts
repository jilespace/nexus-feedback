import i18n from '@/i18n';

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;
const MONTH = 2592000;

export function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.floor((now - date) / 1000);
  const t = i18n.getFixedT(i18n.language);

  if (diff < 0) return t('time.just_now');
  if (diff < MINUTE) return t('time.just_now');
  if (diff < HOUR) return t('time.minutes_ago', { count: Math.floor(diff / MINUTE) });
  if (diff < DAY) return t('time.hours_ago', { count: Math.floor(diff / HOUR) });
  if (diff < WEEK) return t('time.days_ago', { count: Math.floor(diff / DAY) });
  if (diff < MONTH) return t('time.weeks_ago', { count: Math.floor(diff / WEEK) });
  return new Date(dateStr).toLocaleDateString(i18n.language === 'zh' ? 'zh-CN' : 'en-US');
}
