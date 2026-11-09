import { prisma } from '../db/client.js';
import { paginatedResult } from '../utils/pagination.js';

export type NotificationType =
  | 'feedback.created'
  | 'feedback.assigned'
  | 'feedback.status_changed'
  | 'feedback.comment';

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

  await prisma.notification.createMany({
    data: recipients.map((memberId) => ({
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

export async function listNotifications(
  memberId: string,
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
