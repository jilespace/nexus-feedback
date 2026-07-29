import { stringify } from 'csv-stringify/sync';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';

interface ExportFilters {
  status?: string;
  category?: string;
  priority?: string;
  keyword?: string;
}

export async function exportFeedbackCSV(filters: ExportFilters): Promise<string> {
  const where: Prisma.FeedbackWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.category) where.category = filters.category;
  if (filters.priority) where.priority = filters.priority;
  if (filters.keyword) {
    where.OR = [
      { title: { contains: filters.keyword, mode: 'insensitive' } },
      { content: { contains: filters.keyword, mode: 'insensitive' } },
    ];
  }

  const feedbacks = await prisma.feedback.findMany({
    where,
    orderBy: { created_at: 'desc' },
    include: {
      feedbackTags: { include: { tag: true } },
      assignee: { select: { display_name: true } },
    },
  });

  const records = feedbacks.map((f) => ({
    ID: f.id,
    标题: f.title,
    内容: f.content,
    分类: f.category,
    优先级: f.priority,
    状态: f.status,
    投票数: f.vote_count,
    来源: f.source,
    联系方式: f.contact ?? '',
    标签: f.feedbackTags.map((ft) => ft.tag.name).join(', '),
    指派给: f.assignee?.display_name ?? '',
    创建时间: f.created_at.toISOString(),
  }));

  return stringify(records, { header: true });
}
