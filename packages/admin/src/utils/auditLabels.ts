export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'feedback.create': '创建反馈',
  'feedback.update': '更新反馈',
  'feedback.status': '变更状态',
  'feedback.status_change': '变更状态',
  'feedback.delete': '删除反馈',
  'feedback.restore': '恢复反馈',
  'feedback.merge': '合并反馈',
  'feedback.assign': '指派反馈',
  'feedback.batch_assign': '批量指派',
  'feedback.batch_status': '批量变更状态',
  'feedback.batch_tags': '批量标签',
  'reply.create': '回复反馈',
  'comment.create': '添加评论',
  'comment.delete': '删除评论',
  'webhook.create': '创建 Webhook',
  'webhook.update': '更新 Webhook',
  'webhook.delete': '删除 Webhook',
  'member.invite': '邀请成员',
  'member.resend_invite': '重发邀请',
  'member.remove': '移除成员',
  'member.update_role': '变更角色',
  'project.create': '创建项目',
  'project.update': '更新项目',
  'project.delete': '删除项目',
  'project.regenerate_key': '重置 API Key',
};

export type AuditTone = 'brand' | 'amber' | 'blue' | 'green' | 'gray' | 'violet';

export function auditActionTone(action: string): AuditTone {
  if (action.startsWith('member.')) return 'amber';
  if (action.startsWith('project.')) return 'violet';
  if (action.startsWith('webhook.')) return 'blue';
  if (action.startsWith('reply.') || action.startsWith('comment.')) return 'green';
  if (action.startsWith('feedback.')) return 'brand';
  return 'gray';
}

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

const TARGET_LABELS: Record<string, string> = {
  feedback: '反馈',
  member: '成员',
  project: '项目',
  webhook: 'Webhook',
  comment: '评论',
  changelog: '更新日志',
  category: '分类',
  status: '状态',
};

export function auditTargetLabel(targetType: string): string {
  return TARGET_LABELS[targetType] ?? targetType;
}
