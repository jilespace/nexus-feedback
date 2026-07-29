import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client.js', () => ({
  prisma: {
    attachment: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from '../db/client.js';

describe('cleanupOrphanedAttachments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes attachments older than 24h with no feedback', async () => {
    vi.mocked(prisma.attachment.findMany).mockResolvedValue([
      { id: 'att_1' },
      { id: 'att_2' },
    ] as any);
    vi.mocked(prisma.attachment.deleteMany).mockResolvedValue({ count: 2 } as any);

    const { cleanupOrphanedAttachments } = await import('../jobs/digest.js');
    const result = await cleanupOrphanedAttachments();

    expect(result).toBe(2);
    expect(prisma.attachment.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['att_1', 'att_2'] } },
    });
  });

  it('does nothing when no orphaned attachments', async () => {
    vi.mocked(prisma.attachment.findMany).mockResolvedValue([]);

    const { cleanupOrphanedAttachments } = await import('../jobs/digest.js');
    const result = await cleanupOrphanedAttachments();

    expect(result).toBe(0);
    expect(prisma.attachment.deleteMany).not.toHaveBeenCalled();
  });
});
