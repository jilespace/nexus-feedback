import { prisma } from '../db/client.js';
import { NotFoundError } from '../utils/errors.js';
import { parsePagination, paginatedResult } from '../utils/pagination.js';

export async function getPreference(email: string, projectId: string) {
  const pref = await prisma.notificationPreference.findUnique({
    where: { email_project_id: { email, project_id: projectId } },
  });
  if (!pref) {
    return prisma.notificationPreference.create({
      data: { email, project_id: projectId },
    });
  }
  return pref;
}

export async function updatePreference(
  email: string,
  projectId: string,
  data: { status_updates?: boolean; weekly_digest?: boolean },
) {
  const pref = await prisma.notificationPreference.findUnique({
    where: { email_project_id: { email, project_id: projectId } },
  });
  if (!pref) {
    return prisma.notificationPreference.create({
      data: { email, project_id: projectId, ...data },
    });
  }
  return prisma.notificationPreference.update({
    where: { email_project_id: { email, project_id: projectId } },
    data,
  });
}

export async function listPreferences(
  projectId: string,
  pagination?: { page: number; pageSize: number; skip: number; take: number },
) {
  const where = { project_id: projectId };
  const [items, total] = await Promise.all([
    prisma.notificationPreference.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: pagination?.skip,
      take: pagination?.take,
    }),
    prisma.notificationPreference.count({ where }),
  ]);
  return paginatedResult(items, total, pagination?.page ?? 1, pagination?.pageSize ?? 20);
}

export async function deletePreference(email: string, projectId: string) {
  const pref = await prisma.notificationPreference.findUnique({
    where: { email_project_id: { email, project_id: projectId } },
  });
  if (!pref) throw new NotFoundError('通知偏好不存在');
  await prisma.notificationPreference.delete({
    where: { email_project_id: { email, project_id: projectId } },
  });
  return { deleted: true };
}
