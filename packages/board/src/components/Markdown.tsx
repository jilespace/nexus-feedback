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
      nodes.push(
        createElement(
          'strong',
          { key: k, className: 'font-semibold text-ink' },
          match[1],
        ),
      );
    } else if (match[2] !== undefined) {
      nodes.push(createElement('em', { key: k }, match[2]));
    } else if (match[3] !== undefined) {
      nodes.push(
        createElement(
          'code',
          {
            key: k,
            className:
              'rounded border border-line-subtle bg-surface-subtle px-1 py-0.5 font-mono text-[0.85em] text-ink',
          },
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
              className:
                'font-medium text-brand underline underline-offset-2 transition-colors hover:text-brand-strong',
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
              'my-3 overflow-x-auto rounded-control border border-line-strong/40 bg-slate-950 p-3 font-mono text-12 leading-relaxed text-slate-100 dark:bg-black/50',
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
          ? 'mb-2 mt-5 text-16 font-semibold text-ink first:mt-0'
          : level === 2
            ? 'mb-1.5 mt-4 text-14 font-semibold text-ink first:mt-0'
            : 'mb-1 mt-3 text-13 font-semibold text-ink first:mt-0';
      blocks.push(
        createElement(
          ('h' + level) as 'h1' | 'h2' | 'h3',
          { key: key++, className: cls },
          renderInline(text, `h${key}`),
        ),
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
          {
            key: key++,
            className:
              'my-2 list-disc space-y-1.5 pl-5 text-14 leading-relaxed text-ink-secondary marker:text-ink-tertiary',
          },
          items.map((item, idx) =>
            createElement(
              'li',
              { key: idx },
              renderInline(item, `li${key}-${idx}`),
            ),
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
      )
        break;
      paraLines.push(cur);
      i++;
    }
    blocks.push(
      createElement(
        'p',
        {
          key: key++,
          className: 'my-2 text-14 leading-relaxed text-ink-secondary',
        },
        renderInline(paraLines.join('\n'), `p${key}`),
      ),
    );
  }

  return <div className="markdown [overflow-wrap:anywhere]">{blocks}</div>;
}
