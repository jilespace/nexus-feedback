import i18n from '@/i18n';

export type AuditTone = 'brand' | 'amber' | 'blue' | 'green' | 'gray' | 'violet';

/**
 * Resolve a `content` namespace string with the current i18n language.
 * Unknown keys fall back to the provided label (e.g. raw action names).
 */
function contentT(key: string, fallback: string): string {
  return i18n.getFixedT(i18n.language, 'content')(key, {
    defaultValue: fallback,
  });
}

export function auditActionTone(action: string): AuditTone {
  if (action.startsWith('member.')) return 'amber';
  if (action.startsWith('project.')) return 'violet';
  if (action.startsWith('webhook.')) return 'blue';
  if (action.startsWith('reply.') || action.startsWith('comment.')) return 'green';
  if (action.startsWith('feedback.')) return 'brand';
  return 'gray';
}

export function auditActionLabel(action: string): string {
  return contentT(`audit.action.${action}`, action);
}

export function auditTargetLabel(targetType: string): string {
  return contentT(`audit.target.${targetType}`, targetType);
}
