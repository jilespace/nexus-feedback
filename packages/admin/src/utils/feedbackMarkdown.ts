export interface FeedbackMarkdownMeta {
  label: string;
  value: string;
}

export interface FeedbackMarkdownReply {
  author: string;
  time: string;
  content: string;
}

export interface FeedbackMarkdownAttachment {
  name: string;
  url: string;
}

export interface FeedbackMarkdownInput {
  title: string;
  content?: string | null;
  meta: FeedbackMarkdownMeta[];
  replies?: FeedbackMarkdownReply[];
  attachments?: FeedbackMarkdownAttachment[];
  link?: string;
  headings: {
    content: string;
    replies: string;
    attachments: string;
  };
}

/** Escape the characters that would break a markdown link label. */
function escapeLinkLabel(value: string): string {
  return value.replace(/([\\[\]])/g, '\\$1');
}

/** Wrap targets that markdown would otherwise parse incorrectly in angle brackets. */
function formatLinkTarget(url: string): string {
  return /[\s()<>]/.test(url) ? `<${url}>` : url;
}

/**
 * Formats one feedback item as shareable Markdown. Kept pure: every label and
 * formatted value is supplied by the caller so the output always matches the
 * active UI language without importing i18n here.
 *
 * The attachment list is emitted between the body and the replies, and only
 * when at least one attachment is provided.
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

  const attachments = (input.attachments ?? []).filter((attachment) => attachment.url.trim());
  if (attachments.length > 0) {
    lines.push('', `## ${input.headings.attachments}`, '');
    for (const attachment of attachments) {
      const name = escapeLinkLabel(attachment.name.trim() || attachment.url.trim());
      lines.push(`- [${name}](${formatLinkTarget(attachment.url.trim())})`);
    }
  }

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
