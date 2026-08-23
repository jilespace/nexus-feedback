import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  feedback: {
    findMany: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  member: { findFirst: vi.fn() },
};

vi.mock('../db/client.js', () => ({ prisma: mockPrisma }));
vi.mock('../services/notification.js', () => ({
  notifyStatusChange: vi.fn().mockResolvedValue(undefined),
  notifyReply: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../services/webhook.js', () => ({ fireWebhooks: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/audit.js', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));

const { listFeedback, batchAssignFeedback } = await import('../services/feedback.js');

describe('listFeedback assignee filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.feedback.count.mockResolvedValue(0);
  });

  it('maps __unassigned__ sentinel to null assignee_id', async () => {
    mockPrisma.feedback.findMany.mockResolvedValue([]);

    await listFeedback({ assignee_id: '__unassigned__' });

    expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assignee_id: null }),
      }),
    );
  });

  it('passes real assignee id through unchanged', async () => {
    mockPrisma.feedback.findMany.mockResolvedValue([]);

    await listFeedback({ assignee_id: 'mem_1' });

    expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assignee_id: 'mem_1' }),
      }),
    );
  });
});

describe('listFeedback trash view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.feedback.count.mockResolvedValue(0);
  });

  it('trash view filters to deleted feedback only', async () => {
    mockPrisma.feedback.findMany.mockResolvedValue([]);

    await listFeedback({ view: 'trash' });

    expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deleted_at: { not: null } }),
      }),
    );
    expect(mockPrisma.feedback.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deleted_at: { not: null } }),
      }),
    );
  });

  it('default view excludes deleted feedback', async () => {
    mockPrisma.feedback.findMany.mockResolvedValue([]);

    await listFeedback({});

    expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deleted_at: null }),
      }),
    );
  });
});

describe('batchAssignFeedback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('assigns org-scoped ids to a member of the same org', async () => {
    mockPrisma.feedback.findMany.mockResolvedValue([{ id: 'fb_1' }]);
    mockPrisma.member.findFirst.mockResolvedValue({ id: 'mem_1' });
    mockPrisma.feedback.updateMany.mockResolvedValue({ count: 1 });

    const result = await batchAssignFeedback(['fb_1'], 'mem_1', 'org_1');

    expect(result.updated).toBe(1);
    expect(mockPrisma.member.findFirst).toHaveBeenCalledWith({
      where: { id: 'mem_1', org_id: 'org_1' },
      select: { id: true },
    });
    expect(mockPrisma.feedback.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['fb_1'] } },
      data: { assignee_id: 'mem_1' },
    });
  });

  it('rejects when member does not belong to the org', async () => {
    mockPrisma.feedback.findMany.mockResolvedValue([{ id: 'fb_1' }]);
    mockPrisma.member.findFirst.mockResolvedValue(null);

    await expect(batchAssignFeedback(['fb_1'], 'mem_other', 'org_1'))
      .rejects.toThrow('成员不存在');
    expect(mockPrisma.feedback.updateMany).not.toHaveBeenCalled();
  });

  it('rejects when any feedback belongs to another org', async () => {
    mockPrisma.feedback.findMany.mockResolvedValue([]);

    await expect(batchAssignFeedback(['fb_1'], 'mem_1', 'org_1'))
      .rejects.toThrow('反馈不存在');
    expect(mockPrisma.feedback.updateMany).not.toHaveBeenCalled();
  });

  it('allows batch unassign with null assignee', async () => {
    mockPrisma.feedback.findMany.mockResolvedValue([{ id: 'fb_1' }, { id: 'fb_2' }]);
    mockPrisma.feedback.updateMany.mockResolvedValue({ count: 2 });

    const result = await batchAssignFeedback(['fb_1', 'fb_2'], null, 'org_1');

    expect(result.updated).toBe(2);
    expect(mockPrisma.member.findFirst).not.toHaveBeenCalled();
  });
});
