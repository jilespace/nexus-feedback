import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listAuditLogs } from '../audit.js';

vi.mock('../../db/client.js', () => ({
  prisma: {
    auditLog: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from '../../db/client.js';

const findMany = prisma.auditLog.findMany as ReturnType<typeof vi.fn>;
const count = prisma.auditLog.count as ReturnType<typeof vi.fn>;

beforeEach(() => { vi.clearAllMocks(); });

function getLastWhere() {
  return findMany.mock.calls[0][0].where;
}

describe('listAuditLogs', () => {
  it('always scopes the query by org_id', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await listAuditLogs('org-1', {});

    expect(getLastWhere().org_id).toBe('org-1');
  });

  it('filters by member_id when provided', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await listAuditLogs('org-1', { memberId: 'm-1' });

    expect(getLastWhere().member_id).toBe('m-1');
  });

  it('filters by action_prefix using startsWith', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await listAuditLogs('org-1', { actionPrefix: 'feedback.' });

    expect(getLastWhere().action).toEqual({ startsWith: 'feedback.' });
  });

  it('filters by from/to date range on created_at', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    const from = new Date('2026-01-01');
    const to = new Date('2026-01-31');

    await listAuditLogs('org-1', { from, to });

    expect(getLastWhere().created_at).toEqual({ gte: from, lte: to });
  });

  it('omits created_at when no date filters are given', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await listAuditLogs('org-1', { memberId: 'm-1' });

    expect(getLastWhere().created_at).toBeUndefined();
  });

  it('passes the same where clause to count', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await listAuditLogs('org-1', { memberId: 'm-1', actionPrefix: 'feedback.' });

    expect(count.mock.calls[0][0].where).toEqual(getLastWhere());
  });

  it('returns a paginated result with an unchanged shape', async () => {
    const items = [{ id: 'a-1', action: 'feedback.create' }];
    findMany.mockResolvedValue(items);
    count.mockResolvedValue(1);

    const result = await listAuditLogs('org-1', {}, { page: 1, pageSize: 20, skip: 0, take: 20 });

    expect(result).toEqual({ items, page: 1, page_size: 20, total: 1 });
  });
});
