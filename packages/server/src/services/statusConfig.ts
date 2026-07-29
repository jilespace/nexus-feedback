import { prisma } from '../db/client.js';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors.js';

export type DefaultStatus = {
  name: string;
  color: string;
  position: number;
  is_closed: boolean;
};

export function getDefaultStatuses(): DefaultStatus[] {
  return [
    { name: 'open', color: '#3B82F6', position: 0, is_closed: false },
    { name: 'in_progress', color: '#F59E0B', position: 1, is_closed: false },
    { name: 'resolved', color: '#10B981', position: 2, is_closed: false },
    { name: 'closed', color: '#6B7280', position: 3, is_closed: true },
  ];
}

export async function getStatusConfigs(projectId: string) {
  const configs = await prisma.statusConfig.findMany({
    where: { project_id: projectId },
    orderBy: { position: 'asc' },
  });

  if (configs.length === 0) {
    return getDefaultStatuses().map((s) => ({
      id: `default_${s.name}`,
      project_id: projectId,
      ...s,
    }));
  }

  return configs;
}

export async function createStatusConfig(
  projectId: string,
  name: string,
  color: string,
  position: number,
  isClosed: boolean,
) {
  if (!name) throw new ValidationError('状态名称不能为空');

  const config = await prisma.statusConfig.create({
    data: {
      project_id: projectId,
      name,
      color,
      position,
      is_closed: isClosed,
    },
  });

  return config;
}

export async function updateStatusConfig(
  id: string,
  data: { name?: string; color?: string; position?: number; is_closed?: boolean },
) {
  const config = await prisma.statusConfig.findUnique({ where: { id } });
  if (!config) throw new NotFoundError('状态配置不存在');

  return prisma.statusConfig.update({
    where: { id },
    data,
  });
}

export async function deleteStatusConfig(id: string) {
  const config = await prisma.statusConfig.findUnique({ where: { id } });
  if (!config) throw new NotFoundError('状态配置不存在');

  // Check if any feedback uses this status
  const feedbackCount = await prisma.feedback.count({
    where: { status: config.name, project_id: config.project_id },
  });
  if (feedbackCount > 0) {
    throw new ConflictError(`该状态正在被 ${feedbackCount} 条反馈使用，无法删除`);
  }

  await prisma.statusConfig.delete({ where: { id } });
  return { id };
}

export async function validateStatusForProject(
  projectId: string,
  statusName: string,
): Promise<boolean> {
  const configs = await prisma.statusConfig.findMany({
    where: { project_id: projectId },
  });

  if (configs.length === 0) {
    // Use default statuses
    const defaults = getDefaultStatuses();
    return defaults.some((s) => s.name === statusName);
  }

  return configs.some((c) => c.name === statusName);
}
