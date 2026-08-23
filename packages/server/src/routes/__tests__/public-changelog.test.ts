import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

vi.mock('../../db/client.js', () => ({
  prisma: {
    project: { findFirst: vi.fn(), findUnique: vi.fn() },
    feedback: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    categoryConfig: { findMany: vi.fn() },
    comment: { findMany: vi.fn() },
    vote: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    changelog: { findMany: vi.fn() },
    notificationPreference: { findMany: vi.fn() },
  },
}));

vi.mock('../../services/notification.js', () => ({
  notifyNewFeedback: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/audit.js', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from '../../db/client.js';

describe('public changelog scheduled publish visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.project.findFirst).mockResolvedValue({
      id: 'proj_1', slug: 'test', name: 'Test', org_id: 'org_1',
    } as never);
    vi.mocked(prisma.changelog.findMany).mockResolvedValue([] as never);
  });

  it('excludes future-dated entries and includes past/null via published_at window', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/public/test/changelog');

    expect(res.status).toBe(200);
    // 定时条目（published_at 在未来）必须被过滤：过滤条件是
    // published_at IS NULL OR published_at <= now，由数据库执行而非内存筛选
    expect(prisma.changelog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          project_id: 'proj_1',
          published: true,
          OR: [
            { published_at: null },
            { published_at: { lte: expect.any(Date) } },
          ],
        },
      }),
    );
  });
});
