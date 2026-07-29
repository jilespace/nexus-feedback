import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addVote, removeVote } from '../vote.js';

vi.mock('../../db/client.js', () => ({
  prisma: {
    feedback: { findUnique: vi.fn(), update: vi.fn() },
    vote: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '../../db/client.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('VoteService', () => {
  describe('addVote', () => {
    it('should create vote and increment count', async () => {
      (prisma.feedback.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'f-1', vote_count: 0 });
      (prisma.vote.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValue(null);
      (prisma.$transaction as ReturnType<typeof vi.fn>)
        .mockResolvedValue([{ id: 'v-1', email: 'a@b.com', feedback_id: 'f-1' }]);

      const result = await addVote('f-1', 'a@b.com');
      expect(result.id).toBe('v-1');
      expect(result.email).toBe('a@b.com');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw ConflictError for duplicate vote', async () => {
      (prisma.feedback.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'f-1', vote_count: 1 });
      (prisma.vote.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'v-1', email: 'a@b.com' });

      await expect(addVote('f-1', 'a@b.com'))
        .rejects.toThrow('您已经投过票了');
    });
  });

  describe('removeVote', () => {
    it('should delete vote and decrement count', async () => {
      (prisma.vote.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'v-1', email: 'a@b.com' });
      (prisma.$transaction as ReturnType<typeof vi.fn>)
        .mockResolvedValue([]);

      const result = await removeVote('f-1', 'a@b.com');
      expect(result.id).toBe('v-1');
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
