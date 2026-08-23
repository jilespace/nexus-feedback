import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client.js', () => ({
  prisma: {
    feedback: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    reply: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '../db/client.js';
import { getStats } from '../services/feedback.js';

describe('getStats response_time', () => {
  beforeEach(() => vi.clearAllMocks());

  it('includes avg_response_hours in stats', async () => {
    vi.mocked(prisma.feedback.count).mockResolvedValue(10);
    vi.mocked(prisma.feedback.findMany).mockResolvedValue([
      { id: 'fb_1', created_at: new Date('2024-01-01T00:00:00Z') },
    ] as never);
    vi.mocked(prisma.feedback.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.reply.findMany).mockResolvedValue([
      { feedback_id: 'fb_1', created_at: new Date('2024-01-02T00:00:00Z') },
    ] as never);

    const stats = await getStats('proj_1');

    expect(stats).toHaveProperty('avg_response_hours');
    expect(typeof stats.avg_response_hours).toBe('number');
    expect(stats.avg_response_hours).toBe(24);
  });

  it('returns 0 when no replies exist', async () => {
    vi.mocked(prisma.feedback.count).mockResolvedValue(5);
    vi.mocked(prisma.feedback.findMany).mockResolvedValue([]);
    vi.mocked(prisma.feedback.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.reply.findMany).mockResolvedValue([]);

    const stats = await getStats('proj_1');

    expect(stats.avg_response_hours).toBe(0);
  });
});
