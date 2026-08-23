import { prisma } from '../db/client.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { paginatedResult } from '../utils/pagination.js';
import { assertFeedbackIdsInOrg } from '../utils/orgScope.js';

export async function createTag(orgId: string, name: string, color?: string) {
  const existing = await prisma.tag.findUnique({
    where: { name_org_id: { name, org_id: orgId } },
  });
  if (existing) throw new ConflictError('标签已存在');

  const tag = await prisma.tag.create({
    data: { name, color: color || '#6B7280', org_id: orgId },
  });
  return tag;
}

export async function listTags(
  orgId: string,
  pagination?: { page: number; pageSize: number; skip: number; take: number },
) {
  const [items, total] = await Promise.all([
    prisma.tag.findMany({
      where: { org_id: orgId },
      orderBy: { name: 'asc' },
      skip: pagination?.skip,
      take: pagination?.take,
      include: { _count: { select: { feedbackTags: true } } },
    }),
    prisma.tag.count({ where: { org_id: orgId } }),
  ]);

  return paginatedResult(
    items.map((tag) => ({ ...tag, usage_count: tag._count.feedbackTags })),
    total,
    pagination?.page ?? 1,
    pagination?.pageSize ?? 20,
  );
}

export async function deleteTag(orgId: string, tagId: string) {
  const tag = await prisma.tag.findFirst({ where: { id: tagId, org_id: orgId } });
  if (!tag) throw new NotFoundError('标签不存在');

  await prisma.$transaction([
    prisma.feedbackTag.deleteMany({ where: { tag_id: tagId } }),
    prisma.tag.delete({ where: { id: tagId } }),
  ]);
  return { id: tagId };
}

export async function assignTag(feedbackId: string, tagId: string) {
  const existing = await prisma.feedbackTag.findUnique({
    where: { feedback_id_tag_id: { feedback_id: feedbackId, tag_id: tagId } },
  });
  if (existing) throw new ConflictError('标签已关联');

  const ft = await prisma.feedbackTag.create({
    data: { feedback_id: feedbackId, tag_id: tagId },
  });
  return ft;
}

export async function unassignTag(feedbackId: string, tagId: string) {
  const existing = await prisma.feedbackTag.findUnique({
    where: { feedback_id_tag_id: { feedback_id: feedbackId, tag_id: tagId } },
  });
  if (!existing) throw new NotFoundError('标签关联不存在');

  await prisma.feedbackTag.delete({ where: { id: existing.id } });
  return { id: existing.id };
}

export async function getFeedbackTags(feedbackId: string) {
  const feedbackTags = await prisma.feedbackTag.findMany({
    where: { feedback_id: feedbackId },
    include: { tag: true },
  });
  return feedbackTags.map((ft) => ft.tag);
}

export async function batchAssignTags(
  feedbackIds: string[],
  tagIds: string[],
  orgId?: string,
) {
  if (orgId) {
    await assertFeedbackIdsInOrg(orgId, feedbackIds);
  }
  const data = feedbackIds.flatMap((feedback_id) =>
    tagIds.map((tag_id) => ({ feedback_id, tag_id })),
  );
  const result = await prisma.feedbackTag.createMany({
    data,
    skipDuplicates: true,
  });
  return result.count;
}

export async function batchUnassignTags(
  feedbackIds: string[],
  tagIds: string[],
  orgId?: string,
) {
  if (orgId) {
    await assertFeedbackIdsInOrg(orgId, feedbackIds);
  }
  const result = await prisma.feedbackTag.deleteMany({
    where: {
      feedback_id: { in: feedbackIds },
      tag_id: { in: tagIds },
    },
  });
  return result.count;
}
