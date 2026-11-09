export interface FeedbackMarkdownMeta {
  label: string;
  value: string;
}

export interface FeedbackMarkdownReply {
  author: string;
  time: string;
  content: string;
}

export interface FeedbackMarkdownInput {
  title: string;
  content?: string | null;
  meta: FeedbackMarkdownMeta[];
  replies?: FeedbackMarkdownReply[];
  link?: string;
  headings: {
    content: string;
    replies: string;
  };
}

/**
 * Formats one feedback item as shareable Markdown. Kept pure: every label and
 * formatted value is supplied by the caller so the output always matches the
 * active UI language without importing i18n here.
 */
export function buildFeedbackMarkdown(input: FeedbackMarkdownInput): string {
  const lines: string[] = [`# ${input.title.trim() || '—'}`, ''];

  for (const meta of input.meta) {
    if (!meta.value) continue;
    lines.push(`- **${meta.label}**: ${meta.value}`);
  }
  if (input.link) {
    lines.push('', `<${input.link}>`);
  }

  lines.push('', `## ${input.headings.content}`, '');
  lines.push(input.content?.trim() || '—');

  const replies = input.replies ?? [];
  if (replies.length > 0) {
    lines.push('', `## ${input.headings.replies}`, '');
    replies.forEach((reply, index) => {
      lines.push(`### ${reply.author} · ${reply.time}`, '', reply.content.trim() || '—');
      if (index < replies.length - 1) lines.push('');
    });
  }

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}
