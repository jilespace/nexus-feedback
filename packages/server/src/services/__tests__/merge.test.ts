import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockTx = {
  feedback: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  vote: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  },
};

const mockPrisma = {
  $transaction: vi.fn((fn) => fn(mockTx)),
  feedback: { findUnique: vi.fn() },
  vote: { findMany: vi.fn() },
};

vi.mock('../../db/client.js', () => ({ prisma: mockPrisma }));

const { mergeFeedback, previewMerge } = await import('../merge.js');

describe('Merge Service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mergeFeedback merges votes and closes source', async () => {
    mockTx.feedback.findUnique
      .mockResolvedValueOnce({ id: 'src', merged_into_id: null, project_id: 'p1' })
      .mockResolvedValueOnce({ id: 'tgt', project_id: 'p1' });
    mockTx.vote.findMany
      .mockResolvedValueOnce([{ id: 'v1', email: 'a@x.com' }])
      .mockResolvedValueOnce([{ id: 'v2', email: 'a@x.com' }, { id: 'v3', email: 'b@x.com' }]);

    await mergeFeedback('src', 'tgt');
    expect(mockTx.feedback.update).toHaveBeenCalledWith({
      where: { id: 'src' },
      data: { merged_into_id: 'tgt', status: 'closed' },
    });
  });

  it('mergePreview returns vote transfer count', async () => {
    mockPrisma.feedback.findUnique
      .mockResolvedValueOnce({ id: 'src', title: 'Source', merged_into_id: null, project_id: 'p1' })
      .mockResolvedValueOnce({ id: 'tgt', title: 'Target', project_id: 'p1' });
    mockPrisma.vote.findMany
      .mockResolvedValueOnce([{ id: 'v1', email: 'a@x.com' }])
      .mockResolvedValueOnce([{ id: 'v2', email: 'a@x.com' }]);

    const result = await previewMerge('src', 'tgt');
    expect(result.votes_to_transfer).toBe(0);
    expect(result.votes_to_deduplicate).toBe(1);
  });

  it('mergeFeedback throws when source equals target', async () => {
    await expect(mergeFeedback('same', 'same')).rejects.toThrow('不能将反馈合并到自身');
  });

  it('mergePreview throws for cross-project merge', async () => {
    mockPrisma.feedback.findUnique
      .mockResolvedValueOnce({ id: 'src', title: 'Source', project_id: 'p1' })
      .mockResolvedValueOnce({ id: 'tgt', title: 'Target', project_id: 'p2' });

    await expect(previewMerge('src', 'tgt')).rejects.toThrow('只能合并同一项目内的反馈');
  });
});
