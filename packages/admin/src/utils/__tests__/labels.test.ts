import { describe, it, expect } from 'vitest';
import { categoryLabel, categoryColor, priorityLabel, priorityColor, statusLabel, sourceLabel } from '../labels';

describe('labels', () => {
  it('localizes built-in categories per language', () => {
    expect(categoryLabel('bug', 'zh')).toBe('Bug 修复');
    expect(categoryLabel('bug', 'en')).toBe('Bug');
    expect(categoryLabel('feature', 'en-US')).toBe('Feature');
  });

  it('keeps unknown categories as-is', () => {
    expect(categoryLabel('客户之声', 'en')).toBe('客户之声');
  });

  it('returns stable colors and a fallback palette color', () => {
    expect(categoryColor('bug')).toBe('#ef4444');
    expect(categoryColor('feature')).toBe('#6366f1');
    expect(categoryColor('custom-category')).toMatch(/^#[0-9a-f]{6}$/i);
    // Same input always maps to the same fallback color.
    expect(categoryColor('custom-category')).toBe(categoryColor('custom-category'));
  });

  it('localizes priorities and keeps their signal colors', () => {
    expect(priorityLabel('critical', 'zh')).toBe('紧急');
    expect(priorityLabel('critical', 'en')).toBe('Critical');
    expect(priorityColor('low')).toBe('#94a3b8');
    expect(priorityColor('critical')).toBe('#ef4444');
  });

  it('localizes statuses and sources', () => {
    expect(statusLabel('in_progress', 'zh')).toBe('处理中');
    expect(statusLabel('in_progress', 'en')).toBe('In progress');
    expect(sourceLabel('submit-page', 'zh')).toBe('提交页');
    expect(sourceLabel('submit-page', 'en')).toBe('Submit page');
    expect(sourceLabel('import', 'en')).toBe('Import');
    expect(sourceLabel(undefined, 'en')).toBe('—');
  });
});
