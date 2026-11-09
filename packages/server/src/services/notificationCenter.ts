import type { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import { paginatedResult } from '../utils/pagination.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

export type NotificationType =
  | 'feedback.created'
  | 'feedback.assigned'
  | 'feedback.status_changed'
  | 'feedback.comment';

/** One do-not-disturb window (inclusive `start`, exclusive `end`, HH:mm local time). */
export interface DndSlot {
  start: string;
  end: string;
}

/** Do-not-disturb configuration for in-app notifications (local server time). */
export interface DndSettings {
  enabled: boolean;
  /**
   * Up to MAX_DND_SLOTS quiet windows. Any hit mutes in-app notifications.
   * An enabled config with no slots has no effect.
   */
  slots: DndSlot[];
}

export interface NotificationSettings extends Record<NotificationType, boolean> {
  dnd: DndSettings;
}

export const NOTIFICATION_TYPE_KEYS: NotificationType[] = [
  'feedback.created',
  'feedback.assigned',
  'feedback.status_changed',
  'feedback.comment',
];

export const MAX_DND_SLOTS = 5;

export const DEFAULT_DND: DndSettings = { enabled: false, slots: [] };

const DEFAULT_SETTINGS: NotificationSettings = {
  'feedback.created': true,
  'feedback.assigned': true,
  'feedback.status_changed': true,
  'feedback.comment': true,
  dnd: { enabled: false, slots: [] },
};

const DND_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidDndTime(value: unknown): value is string {
  return typeof value === 'string' && DND_TIME_RE.test(value);
}

function timeToMinutes(value: string): number {
  const match = DND_TIME_RE.exec(value);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isSlotHit(slot: DndSlot | undefined, nowMinutes: number): boolean {
  if (!slot || !isValidDndTime(slot.start) || !isValidDndTime(slot.end)) return false;
  const start = timeToMinutes(slot.start);
  const end = timeToMinutes(slot.end);
  // start === end would mute 24h by accident; treat it as "no window".
  if (start === end) return false;
  return start < end ? nowMinutes >= start && nowMinutes < end : nowMinutes >= start || nowMinutes < end;
}

/**
 * Whether `date` (server-local time) falls inside any DND slot.
 * Slots are half-open ([start, end)), may cross midnight and are independent of
 * each other; a config with no valid slots never mutes (so "enabled" alone is a
 * no-op until a window is added). Pure helper so boundary rules stay testable.
 */
export function isWithinDnd(dnd: DndSettings, date: Date = new Date()): boolean {
  if (!dnd.enabled || !Array.isArray(dnd.slots) || dnd.slots.length === 0) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  return dnd.slots.some((slot) => isSlotHit(slot, now));
}

function normalizeSlots(raw: unknown): DndSlot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((slot): slot is DndSlot => {
      if (!slot || typeof slot !== 'object' || Array.isArray(slot)) return false;
      const candidate = slot as Record<string, unknown>;
      return (
        isValidDndTime(candidate.start) &&
        isValidDndTime(candidate.end) &&
        candidate.start !== candidate.end
      );
    })
    .slice(0, MAX_DND_SLOTS)
    .map((slot) => ({ start: slot.start, end: slot.end }));
}

function normalizeDnd(raw: unknown): DndSettings {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  let slots: DndSlot[];
  if (Array.isArray(source.slots)) {
    // Invalid or surplus stored slots are dropped instead of breaking fan-out.
    slots = normalizeSlots(source.slots);
  } else if (
    isValidDndTime(source.start) &&
    isValidDndTime(source.end) &&
    source.start !== source.end
  ) {
    // Backward compatibility: the previous single-window shape { enabled, start, end }.
    slots = [{ start: source.start, end: source.end }];
  } else {
    slots = [];
  }
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_DND.enabled,
    slots,
  };
}

function normalizeSettings(raw: unknown): NotificationSettings {
  const source =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const settings: NotificationSettings = { ...DEFAULT_SETTINGS, dnd: normalizeDnd(source.dnd) };
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
  const now = new Date();
  const allowed = members
    .filter((member) => {
      const settings = normalizeSettings(member.notification_settings);
      if (!settings[params.type]) return false;
      // Quiet hours only mute in-app notifications; email subscriptions live in
      // a separate service and are intentionally unaffected by DND.
      return !isWithinDnd(settings.dnd, now);
    })
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

export async function clearNotifications(memberId: string, orgId: string) {
  const result = await prisma.notification.deleteMany({
    where: { member_id: memberId, org_id: orgId },
  });
  return { deleted: result.count };
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

type DndPatch = { enabled?: boolean; slots?: DndSlot[] };

/**
 * Validate a (partial) DND payload. Slots replace the whole list when present.
 * The legacy single-window { start, end } payload is still accepted and folded
 * into a one-item slot list so older clients keep working during upgrades.
 */
function readDndPatch(value: unknown): DndPatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('免打扰设置格式不正确');
  }
  const patch = value as Record<string, unknown>;
  const result: DndPatch = {};

  if ('enabled' in patch) {
    if (typeof patch.enabled !== 'boolean') {
      throw new ValidationError('免打扰开关必须是布尔值');
    }
    result.enabled = patch.enabled;
  }

  if ('slots' in patch) {
    if (!Array.isArray(patch.slots)) {
      throw new ValidationError('免打扰时段必须是数组');
    }
    if (patch.slots.length > MAX_DND_SLOTS) {
      throw new ValidationError(`最多添加 ${MAX_DND_SLOTS} 个免打扰时段`);
    }
    result.slots = patch.slots.map((slot, index) => {
      if (!slot || typeof slot !== 'object' || Array.isArray(slot)) {
        throw new ValidationError(`第 ${index + 1} 个免打扰时段格式不正确`);
      }
      const candidate = slot as Record<string, unknown>;
      if (!isValidDndTime(candidate.start)) {
        throw new ValidationError(
          `第 ${index + 1} 个免打扰时段的开始时间格式无效，请使用 HH:mm`,
        );
      }
      if (!isValidDndTime(candidate.end)) {
        throw new ValidationError(
          `第 ${index + 1} 个免打扰时段的结束时间格式无效，请使用 HH:mm`,
        );
      }
      if (candidate.start === candidate.end) {
        throw new ValidationError(`第 ${index + 1} 个免打扰时段的开始和结束时间不能相同`);
      }
      return { start: candidate.start, end: candidate.end };
    });
  } else if ('start' in patch || 'end' in patch) {
    // Legacy payload: { enabled?, start, end }.
    if (!isValidDndTime(patch.start)) {
      throw new ValidationError('免打扰开始时间格式无效，请使用 HH:mm');
    }
    if (!isValidDndTime(patch.end)) {
      throw new ValidationError('免打扰结束时间格式无效，请使用 HH:mm');
    }
    if (patch.start === patch.end) {
      throw new ValidationError('免打扰时段的开始和结束时间不能相同');
    }
    result.slots = [{ start: patch.start, end: patch.end }];
  }

  return result;
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
  let validatedDndPatch: DndPatch | undefined;
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'dnd') {
      validatedDndPatch = readDndPatch(value);
      continue;
    }
    if (!NOTIFICATION_TYPE_KEYS.includes(key as NotificationType)) {
      throw new ValidationError(`未知的通知类型: ${key}`);
    }
    if (typeof value !== 'boolean') {
      throw new ValidationError(`通知类型 ${key} 的值必须是布尔值`);
    }
  }

  const current = await getNotificationSettings(memberId, orgId);
  const next: NotificationSettings = {
    ...current,
    dnd: { enabled: current.dnd.enabled, slots: [...current.dnd.slots] },
  };
  for (const key of NOTIFICATION_TYPE_KEYS) {
    if (typeof patch[key] === 'boolean') next[key] = patch[key] as boolean;
  }
  if (validatedDndPatch) {
    if (validatedDndPatch.enabled !== undefined) next.dnd.enabled = validatedDndPatch.enabled;
    if (validatedDndPatch.slots !== undefined) next.dnd.slots = validatedDndPatch.slots;
  }

  await prisma.member.update({
    where: { id: memberId },
    // JSON columns need an explicit cast: NotificationSettings mixes booleans
    // with the nested DND object, which the generated InputJsonValue type does
    // not model structurally.
    data: { notification_settings: next as unknown as Prisma.InputJsonValue },
  });
  return next;
}
