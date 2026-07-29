import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTag, assignTag, unassignTag } from '../tag.js';

vi.mock('../../db/client.js', () => ({
  prisma: {
    tag: { findUnique: vi.fn(), create: vi.fn() },
    feedbackTag: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  },
}));

import { prisma } from '../../db/client.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('TagService', () => {
  describe('createTag', () => {
    it('should create a new tag', async () => {
      (prisma.tag.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.tag.create as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 't-1', name: 'bug', color: '#6B7280', org_id: 'org-1' });

      const result = await createTag('org-1', 'bug');
      expect(result.name).toBe('bug');
      expect(prisma.tag.create).toHaveBeenCalled();
    });

    it('should throw ConflictError for duplicate tag', async () => {
      (prisma.tag.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 't-1', name: 'bug' });

      await expect(createTag('org-1', 'bug'))
        .rejects.toThrow('标签已存在');
    });
  });

  describe('assignTag', () => {
    it('should create feedback-tag junction', async () => {
      (prisma.feedbackTag.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.feedbackTag.create as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'ft-1', feedback_id: 'f-1', tag_id: 't-1' });

      const result = await assignTag('f-1', 't-1');
      expect(result.feedback_id).toBe('f-1');
      expect(result.tag_id).toBe('t-1');
    });
  });

  describe('unassignTag', () => {
    it('should throw NotFoundError if not assigned', async () => {
      (prisma.feedbackTag.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(unassignTag('f-1', 't-1'))
        .rejects.toThrow('标签关联不存在');
    });
  });
});
