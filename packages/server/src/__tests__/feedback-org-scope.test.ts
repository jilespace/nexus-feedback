import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockTx = {
  feedback: { findUnique: vi.fn(), update: vi.fn() },
  vote: { findMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
};

const mockPrisma = {
  $transaction: vi.fn((fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
  project: { findFirst: vi.fn() },
  feedback: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
};

vi.mock('../db/client.js', () => ({ prisma: mockPrisma }));

vi.mock('../services/webhook.js', () => ({ fireWebhooks: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/notification.js', () => ({
  notifyStatusChange: vi.fn().mockResolvedValue(undefined),
  notifyReply: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../services/statusConfig.js', () => ({ validateStatusForProject: vi.fn().mockResolvedValue(true) }));
vi.mock('../services/categoryConfig.js', () => ({ getProjectCategories: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/audit.js', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));

const { prisma } = await import('../db/client.js');
const { listFeedback } = await import('../services/feedback.js');
const { batchUpdateStatus } = await import('../services/feedback.js');
const { mergeFeedback } = await import('../services/merge.js');
const { exportFeedbackCSV } = await import('../services/export.js');

describe('org-scoped feedback service functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.feedback.count).mockResolvedValue(0);
  });

  it('listFeedback scopes to projects of the given org', async () => {
    vi.mocked(prisma.feedback.findMany).mockResolvedValue([]);

    await listFeedback({ org_id: 'org1' });

    expect(prisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          project: { org_id: 'org1' },
        }),
      }),
    );
    expect(prisma.feedback.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          project: { org_id: 'org1' },
        }),
      }),
    );
  });

  it('batchUpdateStatus rejects when any id belongs to another org', async () => {
    vi.mocked(prisma.feedback.findUnique)
      .mockResolvedValueOnce({ id: 'fb1', status: 'open', project_id: 'p1' } as never)
      .mockResolvedValueOnce(null as never);
    vi.mocked(prisma.project.findFirst)
      .mockResolvedValueOnce({ id: 'p1', org_id: 'org1' } as never);

    await expect(batchUpdateStatus(['fb1', 'fb2'], 'closed', 'org1'))
      .rejects.toThrow('反馈不存在');
    expect(prisma.feedback.updateMany).not.toHaveBeenCalled();
  });

  it('mergeFeedback rejects when target is not in the org', async () => {
    mockTx.feedback.findUnique
      .mockResolvedValueOnce({ id: 'src', merged_into_id: null, project_id: 'p1' })
      .mockResolvedValueOnce({ id: 'tgt', project_id: 'p1' });
    vi.mocked(prisma.project.findFirst)
      .mockResolvedValueOnce({ id: 'p1', org_id: 'org1' } as never)
      .mockResolvedValueOnce(null as never);

    await expect(mergeFeedback('src', 'tgt', 'org1')).rejects.toThrow('目标反馈不存在');
    expect(mockTx.feedback.update).not.toHaveBeenCalled();
  });

  it('exportFeedbackCSV scopes rows to the given org', async () => {
    vi.mocked(prisma.feedback.findMany).mockResolvedValue([]);

    await exportFeedbackCSV({}, 'org1');

    expect(prisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          project: { org_id: 'org1' },
        }),
      }),
    );
  });
});
