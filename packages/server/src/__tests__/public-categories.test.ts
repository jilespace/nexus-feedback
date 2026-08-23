import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

vi.mock('../db/client.js', () => ({
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

import { prisma } from '../db/client.js';

describe('GET /api/v1/public/:slug/categories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns custom categories when configured', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({
      id: 'proj_1', slug: 'test', name: 'Test', org_id: 'org_1',
    } as never);
    vi.mocked(prisma.categoryConfig.findMany).mockResolvedValue([
      { id: 'cat_1', project_id: 'proj_1', name: '建议', color: '#10b981', position: 0, created_at: new Date() },
      { id: 'cat_2', project_id: 'proj_1', name: '问题', color: '#ef4444', position: 1, created_at: new Date() },
    ] as never);

    const app = createApp();
    const res = await request(app).get('/api/v1/public/test/categories');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({ name: '建议', color: '#10b981' });
  });

  it('returns default categories when none configured', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({
      id: 'proj_1', slug: 'test', name: 'Test', org_id: 'org_1',
    } as never);
    vi.mocked(prisma.categoryConfig.findMany).mockResolvedValue([]);

    const app = createApp();
    const res = await request(app).get('/api/v1/public/test/categories');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.data.map((c) => (c as { name: string }).name)).toContain('bug');
  });

  it('returns 404 when project not found', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null);

    const app = createApp();
    const res = await request(app).get('/api/v1/public/unknown/categories');

    expect(res.status).toBe(404);
  });
});
