import { prisma } from '../db/client.js';
import { NotFoundError } from '../utils/errors.js';
import { paginatedResult } from '../utils/pagination.js';

export async function createChangelog(
  orgId: string,
  projectId: string,
  title: string,
  content: string,
  publishAt?: string | null,
) {
  return prisma.changelog.create({
    data: {
      org_id: orgId,
      project_id: projectId,
      title,
      content,
      published_at: publishAt ? new Date(publishAt) : null,
    },
  });
}

export async function updateChangelog(
  orgId: string,
  changelogId: string,
  data: { title?: string; content?: string; publish_at?: string | null },
) {
  const existing = await prisma.changelog.findFirst({
    where: { id: changelogId, org_id: orgId },
  });
  if (!existing) throw new NotFoundError('更新日志不存在');
  const { publish_at, ...rest } = data;
  return prisma.changelog.update({
    where: { id: changelogId },
    data: {
      ...rest,
      ...(publish_at !== undefined
        ? { published_at: publish_at ? new Date(publish_at) : null }
        : {}),
    },
  });
}

export async function publishChangelog(orgId: string, changelogId: string, publishAt?: string | null) {
  const existing = await prisma.changelog.findFirst({
    where: { id: changelogId, org_id: orgId },
  });
  if (!existing) throw new NotFoundError('更新日志不存在');
  return prisma.changelog.update({
    where: { id: changelogId },
    data: { published: true, published_at: publishAt ? new Date(publishAt) : new Date() },
  });
}

export async function unpublishChangelog(orgId: string, changelogId: string) {
  const existing = await prisma.changelog.findFirst({
    where: { id: changelogId, org_id: orgId },
  });
  if (!existing) throw new NotFoundError('更新日志不存在');
  return prisma.changelog.update({
    where: { id: changelogId },
    data: { published: false },
  });
}

export async function deleteChangelog(orgId: string, changelogId: string) {
  const existing = await prisma.changelog.findFirst({
    where: { id: changelogId, org_id: orgId },
  });
  if (!existing) throw new NotFoundError('更新日志不存在');
  await prisma.changelog.delete({ where: { id: changelogId } });
}

export async function listChangelogs(
  orgId: string,
  projectId?: string,
  published?: boolean,
  pagination?: { page: number; pageSize: number; skip: number; take: number },
) {
  const where: { org_id: string; project_id?: string; published?: boolean } = {
    org_id: orgId,
  };
  if (projectId) where.project_id = projectId;
  if (published !== undefined) where.published = published;

  const [items, total] = await Promise.all([
    prisma.changelog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: pagination?.skip,
      take: pagination?.take,
      include: { feedbacks: { select: { feedback: { select: { id: true, title: true } } } } },
    }),
    prisma.changelog.count({ where }),
  ]);

  // Flatten the join table so admin clients receive `feedbacks: [{ id, title }]` directly.
  const changelogs = items.map(({ feedbacks, ...changelog }) => ({
    ...changelog,
    feedbacks: (feedbacks ?? []).map((link) => link.feedback),
  }));

  return paginatedResult(changelogs, total, pagination?.page ?? 1, pagination?.pageSize ?? 20);
}

export async function getChangelog(changelogId: string) {
  const changelog = await prisma.changelog.findUnique({
    where: { id: changelogId },
    include: { feedbacks: { include: { feedback: true } } },
  });
  if (!changelog) throw new NotFoundError('更新日志不存在');
  return changelog;
}

export async function linkFeedback(changelogId: string, feedbackId: string) {
  return prisma.changelogFeedback.create({
    data: { changelog_id: changelogId, feedback_id: feedbackId },
  });
}

export async function unlinkFeedback(changelogId: string, feedbackId: string) {
  await prisma.changelogFeedback.delete({
    where: {
      changelog_id_feedback_id: {
        changelog_id: changelogId,
        feedback_id: feedbackId,
      },
    },
  });
}
