import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/client.js', () => ({
  prisma: {
    feedback: { findUnique: vi.fn(), update: vi.fn() },
    categoryConfig: { findMany: vi.fn().mockResolvedValue([]) },
    statusHistory: { create: vi.fn() },
    reply: { findMany: vi.fn() },
  },
}));

vi.mock('../audit.js', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

const { updateFeedbackContent } = await import('../feedback.js');
const { prisma } = await import('../../db/client.js');

const existingFeedback = {
  id: 'fb-1',
  title: 'Original title',
  content: 'Original content',
  category: 'bug',
  priority: 'medium',
  project_id: 'proj-1',
  status: 'open',
};

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.feedback.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existingFeedback);
  (prisma.feedback.update as ReturnType<typeof vi.fn>).mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ ...existingFeedback, ...data }),
  );
});

describe('updateFeedbackContent', () => {
  it('updates only the provided fields', async () => {
    const result = await updateFeedbackContent('fb-1', { title: 'New title' });
    expect(result.title).toBe('New title');
    expect(prisma.feedback.update).toHaveBeenCalledWith({
      where: { id: 'fb-1' },
      data: { title: 'New title' },
    });
  });

  it('rejects an empty payload', async () => {
    await expect(updateFeedbackContent('fb-1', {})).rejects.toThrow('没有需要更新的字段');
    expect(prisma.feedback.update).not.toHaveBeenCalled();
  });

  it('rejects an unsupported category', async () => {
    await expect(
      updateFeedbackContent('fb-1', { category: 'not-a-category' }),
    ).rejects.toThrow('无效的分类');
    expect(prisma.feedback.update).not.toHaveBeenCalled();
  });

  it('rejects an invalid priority', async () => {
    await expect(updateFeedbackContent('fb-1', { priority: 'urgent' })).rejects.toThrow();
    expect(prisma.feedback.update).not.toHaveBeenCalled();
  });

  it('throws when the feedback does not exist', async () => {
    (prisma.feedback.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(updateFeedbackContent('missing', { title: 'x' })).rejects.toThrow('反馈不存在');
  });
});
