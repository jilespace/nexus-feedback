import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors.js';
import { notifyStatusChange, notifyReply } from './notification.js';
import { fireWebhooks } from './webhook.js';
import { validateStatusForProject } from './statusConfig.js';
import { getProjectCategories } from './categoryConfig.js';
import { logAudit } from './audit.js';

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress', 'closed'],
  in_progress: ['resolved', 'closed'],
  resolved: ['in_progress', 'closed'],
  closed: [],
};

const createFeedbackSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  category: z.string().min(1),
  priority: z.enum(PRIORITIES).default('medium'),
  contact: z.string().max(200).optional(),
  app_version: z.string().max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
  attachment_ids: z.array(z.string()).max(5).optional(),
  project_id: z.string().optional(),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;

export async function validateCreateFeedback(data: unknown) {
  const result = createFeedbackSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? '参数校验失败');
  }
  const projectId = result.data.project_id ?? (data as Record<string, unknown>)?.project_id as string;
  if (projectId) {
    const categories = await getProjectCategories(projectId);
    if (!categories.includes(result.data.category)) {
      throw new ValidationError(`无效的分类: ${result.data.category}`);
    }
  }
  return result.data;
}

export async function createFeedback(input: CreateFeedbackInput, projectId: string, source = 'api') {
  const { attachment_ids, metadata, ...feedbackData } = input;

  if (attachment_ids && attachment_ids.length > 0) {
    const attachments = await prisma.attachment.findMany({
      where: { id: { in: attachment_ids }, project_id: projectId },
      select: { id: true },
    });
    if (attachments.length !== attachment_ids.length) {
      throw new ValidationError('附件不存在或不属于当前项目');
    }
  }

  const feedback = await prisma.feedback.create({
    data: {
      ...feedbackData,
      metadata: metadata as Prisma.InputJsonValue | undefined,
      project_id: projectId,
      source,
      ...(attachment_ids && attachment_ids.length > 0
        ? { attachments: { connect: attachment_ids.map((id) => ({ id })) } }
        : {}),
    },
  });

  // Fire webhooks if feedback belongs to a project
  if (feedback.project_id) {
    fireWebhooks(feedback.project_id, 'feedback.created', {
      id: feedback.id,
      title: feedback.title,
      category: feedback.category,
      priority: feedback.priority,
      status: feedback.status,
    }).catch(() => {});
  }

  return {
    id: feedback.id,
    title: feedback.title,
    status: feedback.status,
    created_at: feedback.created_at.toISOString(),
  };
}

export type ListFeedbackParams = {
  status?: string;
  category?: string;
  priority?: string;
  keyword?: string;
  sort_by?: 'newest' | 'oldest' | 'most_voted';
  page?: number;
  page_size?: number;
  assignee_id?: string;
};

export async function listFeedback(params: ListFeedbackParams) {
  const page = params.page ?? 1;
  const pageSize = Math.min(params.page_size ?? 20, 100);
  const where: Prisma.FeedbackWhereInput = {};
  if (params.status) where.status = params.status;
  if (params.category) where.category = params.category;
  if (params.priority) where.priority = params.priority;
  if (params.keyword) {
    where.OR = [
      { title: { contains: params.keyword, mode: 'insensitive' } },
      { content: { contains: params.keyword, mode: 'insensitive' } },
    ];
  }
  if (params.assignee_id) where.assignee_id = params.assignee_id;

  const [items, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: params.sort_by === 'oldest'
        ? { created_at: 'asc' }
        : params.sort_by === 'most_voted'
          ? { vote_count: 'desc' }
          : { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { replies: true, attachments: true } } },
    }),
    prisma.feedback.count({ where }),
  ]);

  return {
    items: items.map((f) => ({
      id: f.id,
      title: f.title,
      category: f.category,
      priority: f.priority,
      status: f.status,
      source: f.source,
      vote_count: f.vote_count,
      created_at: f.created_at.toISOString(),
      reply_count: f._count.replies,
      attachment_count: f._count.attachments,
    })),
    page,
    page_size: pageSize,
    total,
  };
}

export async function getFeedbackDetail(id: string) {
  const feedback = await prisma.feedback.findUnique({
    where: { id },
    include: {
      attachments: true,
      replies: {
        orderBy: { created_at: 'asc' },
        include: { member: { select: { id: true, display_name: true } } },
      },
      project: { select: { id: true, name: true, slug: true } },
      feedbackTags: { include: { tag: true } },
    },
  });
  if (!feedback) throw new NotFoundError('反馈不存在');
  return feedback;
}

export async function updateFeedbackStatus(id: string, newStatus: string, memberId?: string) {
  const feedback = await prisma.feedback.findUnique({ where: { id } });
  if (!feedback) throw new NotFoundError('反馈不存在');

  // If feedback belongs to a project with custom status config, validate against it
  if (feedback.project_id) {
    const isValid = await validateStatusForProject(feedback.project_id, newStatus);
    if (!isValid) {
      throw new ConflictError(`无效的目标状态: ${newStatus}`);
    }
  } else {
    const allowed = VALID_TRANSITIONS[feedback.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new ConflictError(
        `无法将状态从「${feedback.status}」变更为「${newStatus}」`,
      );
    }
  }

  const oldStatus = feedback.status;
  const updated = await prisma.feedback.update({
    where: { id },
    data: { status: newStatus },
  });

  // Record status history
  await prisma.statusHistory.create({
    data: {
      feedback_id: id,
      old_status: oldStatus,
      new_status: newStatus,
      member_id: memberId ?? null,
    },
  });

  notifyStatusChange(id, newStatus).catch(() => {});

  // Fire webhooks
  if (feedback.project_id) {
    fireWebhooks(feedback.project_id, 'feedback.status_changed', {
      id,
      old_status: oldStatus,
      new_status: newStatus,
    }).catch(() => {});
  }

  return { id: updated.id, status: updated.status };
}

export async function addReply(feedbackId: string, content: string, memberId?: string) {
  const feedback = await prisma.feedback.findUnique({ where: { id: feedbackId } });
  if (!feedback) throw new NotFoundError('反馈不存在');
  if (feedback.status === 'closed') {
    throw new ConflictError('无法回复已关闭的反馈');
  }

  const reply = await prisma.reply.create({
    data: {
      feedback_id: feedbackId,
      content,
      member_id: memberId ?? null,
    },
    include: {
      member: { select: { id: true, display_name: true } },
    },
  });

  notifyReply(feedbackId, content).catch(() => {});

  return reply;
}

export async function getStatusHistory(feedbackId: string) {
  const feedback = await prisma.feedback.findUnique({ where: { id: feedbackId } });
  if (!feedback) throw new NotFoundError('反馈不存在');

  return prisma.statusHistory.findMany({
    where: { feedback_id: feedbackId },
    orderBy: { created_at: 'desc' },
    include: {
      member: { select: { id: true, display_name: true } },
    },
  });
}

export async function batchUpdateStatus(ids: string[], status: string) {
  if (!ids.length) throw new ValidationError('ID 列表不能为空');
  if (!Object.keys(VALID_TRANSITIONS).includes(status)) {
    throw new ValidationError(`无效的目标状态: ${status}`);
  }

  const feedbacks = await prisma.feedback.findMany({ where: { id: { in: ids } } });
  if (feedbacks.length !== ids.length) {
    const foundIds = new Set(feedbacks.map((f) => f.id));
    const missing = ids.filter((id) => !foundIds.has(id));
    throw new NotFoundError(`反馈不存在: ${missing.join(', ')}`);
  }

  for (const fb of feedbacks) {
    const allowed = VALID_TRANSITIONS[fb.status];
    if (!allowed || !allowed.includes(status)) {
      throw new ConflictError(
        `无法将反馈「${fb.id}」的状态从「${fb.status}」变更为「${status}」`,
      );
    }
  }

  const result = await prisma.feedback.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });

  return { updated: result.count };
}

export async function getStats() {
  const baseWhere = { deleted_at: null };

  const [total, open, inProgress, resolved, closed, byCategory, bySource] = await Promise.all([
    prisma.feedback.count({ where: baseWhere }),
    prisma.feedback.count({ where: { ...baseWhere, status: 'open' } }),
    prisma.feedback.count({ where: { ...baseWhere, status: 'in_progress' } }),
    prisma.feedback.count({ where: { ...baseWhere, status: 'resolved' } }),
    prisma.feedback.count({ where: { ...baseWhere, status: 'closed' } }),
    prisma.feedback.groupBy({ by: ['category'], where: baseWhere, _count: true }),
    prisma.feedback.groupBy({ by: ['source'], where: baseWhere, _count: true }),
  ]);

  const categoryMap: Record<string, number> = {};
  for (const item of byCategory) {
    categoryMap[item.category] = item._count;
  }

  const sourceMap: Record<string, number> = {};
  for (const item of bySource) {
    sourceMap[item.source] = item._count;
  }

  // by_week: last 8 weeks (ORM-based for portability)
  const recentFeedback = await prisma.feedback.findMany({
    where: { ...baseWhere, created_at: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
    select: { created_at: true },
  });

  const weekMap = new Map<string, number>();
  const monthMap = new Map<string, number>();
  for (const f of recentFeedback) {
    const d = new Date(f.created_at);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1);

    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const weekOfYear = Math.ceil((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    const weekKey = `${weekStart.getFullYear()}-W${String(weekOfYear).padStart(2, '0')}`;
    weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + 1);
  }

  // Time-to-first-response: average hours between feedback creation and first reply
  const replies = await prisma.reply.findMany({
    where: { feedback: { deleted_at: null } },
    select: { feedback_id: true, created_at: true },
    orderBy: { created_at: 'asc' },
  });

  const firstReplyMap = new Map<string, Date>();
  for (const r of replies) {
    if (!firstReplyMap.has(r.feedback_id)) {
      firstReplyMap.set(r.feedback_id, r.created_at);
    }
  }

  const feedbackTimes = await prisma.feedback.findMany({
    where: baseWhere,
    select: { id: true, created_at: true },
  });

  let totalHours = 0;
  let responseCount = 0;
  for (const f of feedbackTimes) {
    const firstReply = firstReplyMap.get(f.id);
    if (firstReply) {
      const diffHours = (firstReply.getTime() - f.created_at.getTime()) / (1000 * 60 * 60);
      totalHours += diffHours;
      responseCount++;
    }
  }
  const avgResponseHours = responseCount > 0 ? Math.round(totalHours / responseCount * 100) / 100 : 0;

  return {
    total,
    open,
    in_progress: inProgress,
    resolved,
    closed,
    by_category: categoryMap,
    by_week: [...weekMap.entries()].map(([week, count]) => ({ week, count })),
    by_source: sourceMap,
    by_month: [...monthMap.entries()].map(([month, count]) => ({ month, count })),
    avg_response_hours: avgResponseHours,
  };
}

export async function softDeleteFeedback(id: string) {
  const feedback = await prisma.feedback.findUnique({ where: { id } });
  if (!feedback) throw new NotFoundError('反馈不存在');
  return prisma.feedback.update({
    where: { id },
    data: { deleted_at: new Date() },
  });
}

export async function restoreFeedback(id: string) {
  const feedback = await prisma.feedback.findUnique({ where: { id } });
  if (!feedback) throw new NotFoundError('反馈不存在');
  return prisma.feedback.update({
    where: { id },
    data: { deleted_at: null },
  });
}

export async function assignFeedback(
  feedbackId: string,
  assigneeId: string | null,
  orgId: string,
) {
  const feedback = await prisma.feedback.findUnique({
    where: { id: feedbackId },
    select: { id: true, project_id: true },
  });
  if (!feedback) {
    throw new NotFoundError('Feedback not found');
  }

  if (assigneeId !== null) {
    const member = await prisma.member.findFirst({
      where: { id: assigneeId, org_id: orgId },
      select: { id: true },
    });
    if (!member) {
      throw new NotFoundError('Member not found in organization');
    }
  }

  const updated = await prisma.feedback.update({
    where: { id: feedbackId },
    data: { assignee_id: assigneeId },
    include: {
      assignee: { select: { id: true, display_name: true, email: true } },
    },
  });

  fireWebhooks(feedback.project_id, 'feedback.assigned', {
    feedback_id: feedbackId,
    assignee_id: assigneeId,
  }).catch(() => {});

  return updated;
}
