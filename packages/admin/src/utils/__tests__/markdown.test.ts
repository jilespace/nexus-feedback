import { describe, it, expect } from 'vitest';
import { formatDateTime, markdownToPlainText } from '../markdown';

describe('markdown utils', () => {
  it('flattens markdown into a single-line excerpt', () => {
    const source = [
      '## 新功能',
      '- 支持 **批量导出**',
      '- 查看 [文档](https://example.com)',
      '```js',
      'console.log(1)',
      '```',
      '![截图](https://example.com/a.png)',
    ].join('\n');

    const plain = markdownToPlainText(source);
    expect(plain).not.toContain('#');
    expect(plain).not.toContain('**');
    expect(plain).not.toContain('](http');
    expect(plain).toContain('新功能');
    expect(plain).toContain('批量导出');
    expect(plain).toContain('文档');
    expect(plain.split('\n')).toHaveLength(1);
  });

  it('formats dates for changelog display', () => {
    const formatted = formatDateTime('2026-11-10T04:05:00.000Z');
    expect(formatted).toMatch(/^2026-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});
