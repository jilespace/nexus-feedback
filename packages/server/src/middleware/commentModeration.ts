const BANNED_WORDS = ['垃圾广告', '赌博', '色情', 'viper', 'casino'];

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

export function containsBannedWords(content: string): boolean {
  const lower = content.toLowerCase();
  return BANNED_WORDS.some((word) => lower.includes(word.toLowerCase()));
}

export function sanitizeContent(content: string): string {
  const trimmed = content.replace(/\s+/g, ' ').trim();
  return trimmed.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] || char);
}

export function moderateComment(content: string): { approved: boolean; reason?: string } {
  if (containsBannedWords(content)) {
    return { approved: false, reason: '内容包含不当词汇' };
  }
  if (content.length < 2) {
    return { approved: false, reason: '评论内容过短' };
  }
  if (content.length > 1000) {
    return { approved: false, reason: '评论内容过长' };
  }
  return { approved: true };
}
