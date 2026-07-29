import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client.js', () => ({
  prisma: {
    feedback: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    member: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from '../db/client.js';
import { assignFeedback } from '../services/feedback.js';

describe('assignFeedback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('assigns feedback to a member in the same org', async () => {
    vi.mocked(prisma.feedback.findUnique).mockResolvedValue({
      id: 'fb_1', project_id: 'proj_1',
    } as any);
    vi.mocked(prisma.member.findFirst).mockResolvedValue({
      id: 'mem_1', org_id: 'org_1',
    } as any);
    vi.mocked(prisma.feedback.update).mockResolvedValue({
      id: 'fb_1', assignee_id: 'mem_1',
    } as any);

    const result = await assignFeedback('fb_1', 'mem_1', 'org_1');

    expect(result.assignee_id).toBe('mem_1');
    expect(prisma.feedback.update).toHaveBeenCalledWith({
      where: { id: 'fb_1' },
      data: { assignee_id: 'mem_1' },
      include: {
        assignee: { select: { id: true, display_name: true, email: true } },
      },
    });
  });

  it('throws when feedback not found', async () => {
    vi.mocked(prisma.feedback.findUnique).mockResolvedValue(null);

    await expect(assignFeedback('missing', 'mem_1', 'org_1'))
      .rejects.toThrow('Feedback not found');
  });

  it('throws when member not in org', async () => {
    vi.mocked(prisma.feedback.findUnique).mockResolvedValue({
      id: 'fb_1', project_id: 'proj_1',
    } as any);
    vi.mocked(prisma.member.findFirst).mockResolvedValue(null);

    await expect(assignFeedback('fb_1', 'mem_1', 'org_1'))
      .rejects.toThrow('Member not found in organization');
  });

  it('allows unassigning (null assignee)', async () => {
    vi.mocked(prisma.feedback.findUnique).mockResolvedValue({
      id: 'fb_1', project_id: 'proj_1',
    } as any);
    vi.mocked(prisma.feedback.update).mockResolvedValue({
      id: 'fb_1', assignee_id: null,
    } as any);

    const result = await assignFeedback('fb_1', null, 'org_1');

    expect(result.assignee_id).toBeNull();
    expect(prisma.member.findFirst).not.toHaveBeenCalled();
  });
});
