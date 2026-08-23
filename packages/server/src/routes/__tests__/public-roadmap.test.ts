import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

vi.mock('../../db/client.js', () => ({
  prisma: {
    project: { findFirst: vi.fn(), findUnique: vi.fn() },
    feedback: { findMany: vi.fn() },
    statusConfig: { findMany: vi.fn() },
  },
}));

import { prisma } from '../../db/client.js';

describe('GET /roadmap with custom status configs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.project.findFirst).mockResolvedValue({
      id: 'proj_1', slug: 'test', name: 'Test', org_id: 'org_1',
    } as never);
  });

  it('returns mode custom with columns when StatusConfig exists', async () => {
    vi.mocked(prisma.statusConfig.findMany).mockResolvedValue([
      { id: 'sc_1', project_id: 'proj_1', name: 'backlog', color: '#FF0000', position: 0, is_closed: false },
      { id: 'sc_2', project_id: 'proj_1', name: 'doing', color: '#00FF00', position: 1, is_closed: true },
    ] as never);
    vi.mocked(prisma.feedback.findMany).mockResolvedValue([
      { id: 'fb_1', title: 'A', status: 'backlog', category: 'bug', vote_count: 5 },
      { id: 'fb_2', title: 'B', status: 'doing', category: 'feature', vote_count: 2 },
    ] as never);

    const app = createApp();
    const res = await request(app).get('/api/v1/public/test/roadmap');

    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe('custom');
    expect(res.body.data.columns).toHaveLength(2);
    expect(res.body.data.columns[0]).toMatchObject({
      key: 'backlog', name: 'backlog', color: '#FF0000',
    });
    expect(res.body.data.columns[0].items).toEqual([
      { id: 'fb_1', title: 'A', status: 'backlog', category: 'bug', vote_count: 5 },
    ]);
    expect(res.body.data.columns[1].items).toEqual([
      { id: 'fb_2', title: 'B', status: 'doing', category: 'feature', vote_count: 2 },
    ]);
  });

  it('returns mode default when no StatusConfig exists', async () => {
    vi.mocked(prisma.statusConfig.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.feedback.findMany).mockResolvedValue([
      { id: 'fb_1', title: 'A', status: 'open', category: 'bug', vote_count: 5 },
    ] as never);

    const app = createApp();
    const res = await request(app).get('/api/v1/public/test/roadmap');

    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe('default');
    expect(res.body.data.planned).toHaveLength(1);
    expect(res.body.data.in_progress).toHaveLength(0);
    expect(res.body.data.completed).toHaveLength(0);
  });
});
