import { createElement, type ReactNode } from 'react';

function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

// 仅支持 http(s) 链接，其余按纯文本渲染，防止 javascript: 等注入
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const k = `${keyPrefix}-${key++}`;
    if (match[1] !== undefined) {
      nodes.push(createElement('strong', { key: k }, match[1]));
    } else if (match[2] !== undefined) {
      nodes.push(createElement('em', { key: k }, match[2]));
    } else if (match[3] !== undefined) {
      nodes.push(
        createElement(
          'code',
          { key: k, className: 'rounded bg-surface-2 px-1 py-0.5 text-[0.85em] text-gray-800' },
          match[3],
        ),
      );
    } else if (match[4] !== undefined && match[5] !== undefined) {
      if (isSafeUrl(match[5])) {
        nodes.push(
          createElement(
            'a',
            {
              key: k,
              href: match[5],
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'text-brand-600 underline underline-offset-2 hover:text-brand-700',
            },
            match[4],
          ),
        );
      } else {
        // 不安全协议的链接降级为纯文本
        nodes.push(`[${match[4]}](${match[5]})`);
      }
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function Markdown({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line: string = lines[i] ?? '';
    if (line.trim() === '') {
      i++;
      continue;
    }

    // 围栏代码块
    if (line.trimStart().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length) {
        const cur: string | undefined = lines[i];
        if (cur === undefined || cur.trimStart().startsWith('```')) break;
        codeLines.push(cur);
        i++;
      }
      i++; // 跳过结束 ```
      blocks.push(
        createElement(
          'pre',
          {
            key: key++,
            className:
              'my-3 overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs leading-relaxed text-gray-100',
          },
          createElement('code', null, codeLines.join('\n')),
        ),
      );
      continue;
    }

    // 标题
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const hashes: string = heading[1] ?? '#';
      const text: string = heading[2] ?? '';
      const level = hashes.length;
      const cls =
        level === 1
          ? 'mt-4 mb-2 text-base font-bold text-gray-900'
          : level === 2
            ? 'mt-3 mb-2 text-sm font-semibold text-gray-900'
            : 'mt-2 mb-1 text-sm font-medium text-gray-800';
      blocks.push(
        createElement(('h' + level) as 'h1' | 'h2' | 'h3', { key: key++, className: cls }, renderInline(text, `h${key}`)),
      );
      i++;
      continue;
    }

    // 无序列表（连续的 - 行）
    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const cur: string | undefined = lines[i];
        if (cur === undefined || !/^\s*-\s+/.test(cur)) break;
        items.push(cur.replace(/^\s*-\s+/, ''));
        i++;
      }
      blocks.push(
        createElement(
          'ul',
          { key: key++, className: 'my-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-600' },
          items.map((item, idx) =>
            createElement('li', { key: idx }, renderInline(item, `li${key}-${idx}`)),
          ),
        ),
      );
      continue;
    }

    // 普通段落（空行前的连续非空行）
    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur: string | undefined = lines[i];
      if (
        cur === undefined ||
        cur.trim() === '' ||
        /^(#{1,3})\s+/.test(cur) ||
        /^\s*-\s+/.test(cur) ||
        cur.trimStart().startsWith('```')
      ) break;
      paraLines.push(cur);
      i++;
    }
    blocks.push(
      createElement(
        'p',
        { key: key++, className: 'my-2 text-sm leading-relaxed text-gray-600' },
        renderInline(paraLines.join('\n'), `p${key}`),
      ),
    );
  }

  return <div className="markdown">{blocks}</div>;
}
