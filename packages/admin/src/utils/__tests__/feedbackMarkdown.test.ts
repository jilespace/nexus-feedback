import { describe, it, expect } from 'vitest';
import { buildFeedbackMarkdown } from '../feedbackMarkdown';

const headings = { content: '内容', replies: '回复' };

describe('buildFeedbackMarkdown', () => {
  it('renders a shareable document with metadata, content and replies', () => {
    const markdown = buildFeedbackMarkdown({
      title: '登录页偶发白屏',
      content: '在 Safari 下刷新时白屏，控制台无报错。',
      meta: [
        { label: '状态', value: '处理中' },
        { label: '分类', value: 'Bug 修复' },
        { label: '负责人', value: '' },
      ],
      replies: [
        { author: 'Admin', time: '2026-11-10 10:00', content: '已复现，正在排查。' },
        { author: '系统', time: '2026-11-10 11:00', content: '状态变更为已解决。' },
      ],
      link: 'https://example.com/feedback/1',
      headings,
    });

    expect(markdown.startsWith('# 登录页偶发白屏\n')).toBe(true);
    expect(markdown).toContain('- **状态**: 处理中');
    expect(markdown).toContain('- **分类**: Bug 修复');
    expect(markdown).not.toContain('**负责人**');
    expect(markdown).toContain('<https://example.com/feedback/1>');
    expect(markdown).toContain('## 内容\n\n在 Safari 下刷新时白屏');
    expect(markdown).toContain('## 回复');
    expect(markdown).toContain('### Admin · 2026-11-10 10:00');
    expect(markdown).toContain('### 系统 · 2026-11-10 11:00');
    expect(markdown.endsWith('\n')).toBe(true);
  });

  it('handles empty content and missing replies', () => {
    const markdown = buildFeedbackMarkdown({
      title: '   ',
      content: null,
      meta: [],
      headings,
    });
    expect(markdown).toBe('# —\n\n## 内容\n\n—\n');
    expect(markdown).not.toContain('## 回复');
  });

  it('keeps multiline content and reply bodies intact', () => {
    const markdown = buildFeedbackMarkdown({
      title: '多行',
      content: '第一行\n\n- 列表项',
      meta: [],
      replies: [{ author: 'A', time: 't', content: '第一行\n第二行' }],
      headings,
    });
    expect(markdown).toContain('第一行\n\n- 列表项');
    expect(markdown).toContain('第一行\n第二行');
  });
});
