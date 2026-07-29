import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client.js', () => ({
  prisma: {
    feedback: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from '../db/client.js';
import { listFeedback } from '../services/feedback.js';

describe('listFeedback with assignee_id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filters by assignee_id when provided', async () => {
    vi.mocked(prisma.feedback.findMany).mockResolvedValue([]);
    vi.mocked(prisma.feedback.count).mockResolvedValue(0);

    await listFeedback({ assignee_id: 'mem_1' });

    expect(prisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assignee_id: 'mem_1' }),
      }),
    );
  });

  it('does not filter by assignee_id when not provided', async () => {
    vi.mocked(prisma.feedback.findMany).mockResolvedValue([]);
    vi.mocked(prisma.feedback.count).mockResolvedValue(0);

    await listFeedback({});

    expect(prisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ assignee_id: expect.anything() }),
      }),
    );
  });
});
