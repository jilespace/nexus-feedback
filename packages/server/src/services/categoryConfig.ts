import { prisma } from '../db/client.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

export async function listCategoryConfigs(projectId: string) {
  return prisma.categoryConfig.findMany({
    where: { project_id: projectId },
    orderBy: { position: 'asc' },
  });
}

export async function createCategoryConfig(
  projectId: string,
  data: { name: string; color?: string },
) {
  if (!data.name?.trim()) throw new ValidationError('分类名称不能为空');
  const count = await prisma.categoryConfig.count({ where: { project_id: projectId } });
  return prisma.categoryConfig.create({
    data: {
      project_id: projectId,
      name: data.name.trim(),
      color: data.color || '#6B7280',
      position: count,
    },
  });
}

export async function updateCategoryConfig(
  projectId: string,
  id: string,
  data: { name?: string; color?: string; position?: number },
) {
  const existing = await prisma.categoryConfig.findUnique({ where: { id } });
  if (!existing || existing.project_id !== projectId) {
    throw new NotFoundError('分类不存在');
  }
  return prisma.categoryConfig.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.position !== undefined && { position: data.position }),
    },
  });
}

export async function deleteCategoryConfig(projectId: string, id: string) {
  const existing = await prisma.categoryConfig.findUnique({ where: { id } });
  if (!existing || existing.project_id !== projectId) {
    throw new NotFoundError('分类不存在');
  }
  await prisma.categoryConfig.delete({ where: { id } });
  return { deleted: true };
}

export async function getProjectCategories(projectId: string): Promise<string[]> {
  const configs = await prisma.categoryConfig.findMany({
    where: { project_id: projectId },
    orderBy: { position: 'asc' },
    select: { name: true },
  });
  if (configs.length === 0) {
    return ['bug', 'feature', 'performance', 'ui', 'other'];
  }
  return configs.map((c) => c.name);
}

const DEFAULT_CATEGORY_OBJECTS = [
  { name: 'bug', color: '#ef4444' },
  { name: 'feature', color: '#6366f1' },
  { name: 'performance', color: '#f59e0b' },
  { name: 'ui', color: '#8b5cf6' },
  { name: 'other', color: '#6b7280' },
];

export async function getProjectCategoryObjects(projectId: string): Promise<{ name: string; color: string }[]> {
  const configs = await prisma.categoryConfig.findMany({
    where: { project_id: projectId },
    orderBy: { position: 'asc' },
    select: { name: true, color: true },
  });
  if (configs.length === 0) {
    return DEFAULT_CATEGORY_OBJECTS;
  }
  return configs.map((c) => ({ name: c.name, color: c.color }));
}
