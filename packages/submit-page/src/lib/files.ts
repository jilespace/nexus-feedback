export const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'];
export const ACCEPT_ATTR = ALLOWED_TYPES.join(',');
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_FILES = 5;
export const MAX_CONTENT = 1000;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/** 返回人类可读的错误；通过校验时返回 null。 */
export function validateAttachment(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `「${file.name}」格式不支持，仅支持 PNG、JPG、GIF、WebP 或 PDF`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `「${file.name}」超过 10MB，请压缩后重试`;
  }
  return null;
}
