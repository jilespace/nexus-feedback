import type { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import { paginatedResult } from '../utils/pagination.js';

export async function logAudit(params: {
  orgId: string;
  memberId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      org_id: params.orgId,
      member_id: params.memberId,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function listAuditLogs(
  orgId: string,
  filters: { action?: string; memberId?: string; actionPrefix?: string; from?: Date; to?: Date },
  pagination?: { page: number; pageSize: number; skip: number; take: number },
) {
  const where: Record<string, unknown> = { org_id: orgId };
  if (filters.action) where.action = filters.action;
  if (filters.actionPrefix) where.action = { startsWith: filters.actionPrefix };
  if (filters.memberId) where.member_id = filters.memberId;

  const createdAt: Record<string, Date> = {};
  if (filters.from) createdAt.gte = filters.from;
  if (filters.to) createdAt.lte = filters.to;
  if (Object.keys(createdAt).length > 0) where.created_at = createdAt;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: pagination?.skip,
      take: pagination?.take,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return paginatedResult(items, total, pagination?.page ?? 1, pagination?.pageSize ?? 20);
}
