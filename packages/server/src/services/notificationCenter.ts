import { prisma } from '../db/client.js';
import { paginatedResult } from '../utils/pagination.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

export type NotificationType =
  | 'feedback.created'
  | 'feedback.assigned'
  | 'feedback.status_changed'
  | 'feedback.comment';

export type NotificationSettings = Record<NotificationType, boolean>;

export const NOTIFICATION_TYPE_KEYS: NotificationType[] = [
  'feedback.created',
  'feedback.assigned',
  'feedback.status_changed',
  'feedback.comment',
];

const DEFAULT_SETTINGS: NotificationSettings = {
  'feedback.created': true,
  'feedback.assigned': true,
  'feedback.status_changed': true,
  'feedback.comment': true,
};

function normalizeSettings(raw: unknown): NotificationSettings {
  const source =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of NOTIFICATION_TYPE_KEYS) {
    if (typeof source[key] === 'boolean') settings[key] = source[key] as boolean;
  }
  return settings;
}

const STAFF_ROLES = ['owner', 'admin'];

async function staffMemberIds(orgId: string): Promise<string[]> {
  const members = await prisma.member.findMany({
    where: { org_id: orgId, role: { in: STAFF_ROLES } },
    select: { id: true },
  });
  return members.map((member) => member.id);
}

async function createForRecipients(params: {
  orgId: string;
  memberIds: string[];
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  feedbackId?: string | null;
  excludeMemberId?: string | null;
}) {
  const recipients = [...new Set(params.memberIds)].filter(
    (id) => Boolean(id) && id !== params.excludeMemberId,
  );
  if (recipients.length === 0) return 0;

  // Per-member preferences: a member can mute a notification type; missing
  // settings mean "everything enabled" for backward compatibility.
  const members = await prisma.member.findMany({
    where: { id: { in: recipients } },
    select: { id: true, notification_settings: true },
  });
  const allowed = members
    .filter((member) => normalizeSettings(member.notification_settings)[params.type])
    .map((member) => member.id);
  if (allowed.length === 0) return 0;

  await prisma.notification.createMany({
    data: allowed.map((memberId) => ({
      org_id: params.orgId,
      member_id: memberId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
      feedback_id: params.feedbackId ?? null,
    })),
  });
  return recipients.length;
}

export async function notifyFeedbackCreated(params: {
  orgId: string;
  feedbackId: string;
  title: string;
  category: string;
  priority: string;
  source: string;
  actorId?: string | null;
}) {
  const staff = await staffMemberIds(params.orgId);
  await createForRecipients({
    orgId: params.orgId,
    memberIds: staff,
    type: 'feedback.created',
    title: `新反馈：${params.title}`,
    body: `${params.category} · 优先级 ${params.priority} · 来自 ${params.source}`,
    link: `/feedback/${params.feedbackId}`,
    feedbackId: params.feedbackId,
    excludeMemberId: params.actorId,
  });
}

export async function notifyFeedbackAssigned(params: {
  orgId: string;
  feedbackId: string;
  title: string;
  assigneeId: string;
  actorId?: string | null;
}) {
  await createForRecipients({
    orgId: params.orgId,
    memberIds: [params.assigneeId],
    type: 'feedback.assigned',
    title: `反馈已指派给你：${params.title}`,
    body: '打开反馈查看详情并跟进处理',
    link: `/feedback/${params.feedbackId}`,
    feedbackId: params.feedbackId,
    excludeMemberId: params.actorId,
  });
}

export async function notifyFeedbackStatusChanged(params: {
  orgId: string;
  feedbackId: string;
  title: string;
  oldStatus: string;
  newStatus: string;
  assigneeId?: string | null;
  actorId?: string | null;
}) {
  const recipients = params.assigneeId
    ? [params.assigneeId]
    : await staffMemberIds(params.orgId);
  await createForRecipients({
    orgId: params.orgId,
    memberIds: recipients,
    type: 'feedback.status_changed',
    title: `反馈状态更新：${params.title}`,
    body: `${params.oldStatus} → ${params.newStatus}`,
    link: `/feedback/${params.feedbackId}`,
    feedbackId: params.feedbackId,
    excludeMemberId: params.actorId,
  });
}

export async function notifyFeedbackComment(params: {
  orgId: string;
  feedbackId: string;
  title: string;
  excerpt: string;
  assigneeId?: string | null;
  actorId?: string | null;
}) {
  const staff = await staffMemberIds(params.orgId);
  const recipients = params.assigneeId ? [params.assigneeId, ...staff] : staff;
  await createForRecipients({
    orgId: params.orgId,
    memberIds: recipients,
    type: 'feedback.comment',
    title: `新评论：${params.title}`,
    body: params.excerpt.slice(0, 120),
    link: `/feedback/${params.feedbackId}`,
    feedbackId: params.feedbackId,
    excludeMemberId: params.actorId,
  });
}

export async function listNotifications(  memberId: string,
  orgId: string,
  options: { page: number; pageSize: number; skip: number; take: number; unreadOnly?: boolean },
) {
  const where = {
    member_id: memberId,
    org_id: orgId,
    ...(options.unreadOnly ? { read_at: null } : {}),
  };
  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: options.skip,
      take: options.take,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { member_id: memberId, org_id: orgId, read_at: null },
    }),
  ]);

  return {
    ...paginatedResult(items, total, options.page, options.pageSize),
    unread_count: unreadCount,
  };
}

export async function getUnreadNotificationCount(memberId: string, orgId: string) {
  const count = await prisma.notification.count({
    where: { member_id: memberId, org_id: orgId, read_at: null },
  });
  return { count };
}

export async function markNotificationRead(
  memberId: string,
  orgId: string,
  notificationId: string,
) {
  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      member_id: memberId,
      org_id: orgId,
      read_at: null,
    },
    data: { read_at: new Date() },
  });
  return { updated: result.count > 0 };
}

export async function markAllNotificationsRead(memberId: string, orgId: string) {
  const result = await prisma.notification.updateMany({
    where: { member_id: memberId, org_id: orgId, read_at: null },
    data: { read_at: new Date() },
  });
  return { updated: result.count };
}

export async function deleteNotification(
  memberId: string,
  orgId: string,
  notificationId: string,
) {
  const result = await prisma.notification.deleteMany({
    where: { id: notificationId, member_id: memberId, org_id: orgId },
  });
  return { deleted: result.count > 0 };
}

export async function getNotificationSettings(
  memberId: string,
  orgId: string,
): Promise<NotificationSettings> {
  const member = await prisma.member.findFirst({
    where: { id: memberId, org_id: orgId },
    select: { notification_settings: true },
  });
  if (!member) throw new NotFoundError('成员不存在');
  return normalizeSettings(member.notification_settings);
}

export async function updateNotificationSettings(
  memberId: string,
  orgId: string,
  input: unknown,
): Promise<NotificationSettings> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('通知偏好格式不正确');
  }
  const patch = input as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (!NOTIFICATION_TYPE_KEYS.includes(key as NotificationType)) {
      throw new ValidationError(`未知的通知类型: ${key}`);
    }
    if (typeof value !== 'boolean') {
      throw new ValidationError(`通知类型 ${key} 的值必须是布尔值`);
    }
  }

  const current = await getNotificationSettings(memberId, orgId);
  const next: NotificationSettings = { ...current };
  for (const key of NOTIFICATION_TYPE_KEYS) {
    if (typeof patch[key] === 'boolean') next[key] = patch[key] as boolean;
  }

  await prisma.member.update({
    where: { id: memberId },
    data: { notification_settings: next },
  });
  return next;
}
