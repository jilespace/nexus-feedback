import { prisma } from '../db/client.js';
import { parsePagination, paginatedResult } from '../utils/pagination.js';

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
      metadata: params.metadata as any,
    },
  });
}

export async function listAuditLogs(
  orgId: string,
  filters: { action?: string; memberId?: string },
  pagination?: { page: number; pageSize: number; skip: number; take: number },
) {
  const where: Record<string, unknown> = { org_id: orgId };
  if (filters.action) where.action = filters.action;
  if (filters.memberId) where.member_id = filters.memberId;

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
