import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  project: { findFirst: vi.fn(), findMany: vi.fn() },
  feedback: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
}));

vi.mock('../../db/client.js', () => ({ prisma: mockPrisma }));

import { prisma } from '../../db/client.js';
const { assertProjectInOrg, getOrgProjectIds } = await import('../orgScope.js');
const { getFeedbackDetail } = await import('../../services/feedback.js');
const { NotFoundError } = await import('../../utils/errors.js');

describe('orgScope helpers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getOrgProjectIds returns project ids of the org', async () => {
    mockPrisma.project.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);

    const ids = await getOrgProjectIds('org1');
    expect(ids).toEqual(['p1', 'p2']);
    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: { org_id: 'org1' },
      select: { id: true },
    });
  });

  it('assertProjectInOrg throws NotFoundError when project is not in org', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);

    await expect(assertProjectInOrg('org1', 'other-org-project'))
      .rejects.toThrow(NotFoundError);
    await expect(assertProjectInOrg('org1', 'other-org-project'))
      .rejects.toThrow('项目不存在');
  });
});

describe('getFeedbackDetail org scoping', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when the feedback belongs to another org', async () => {
    // Feedback exists in DB but its project belongs to a different org.
    mockPrisma.feedback.findUnique.mockImplementation(async ({ where }: { where: unknown }) => {
      const id = (where as { id: string }).id;
      if (id === 'fb-other') {
        return { id, project: { org_id: 'org-b' } };
      }
      return null;
    });

    await expect(getFeedbackDetail('fb-other', 'org-a')).rejects.toThrow('反馈不存在');
  });

  it('returns 404 when the feedback does not exist at all', async () => {
    mockPrisma.feedback.findUnique.mockResolvedValue(null);

    await expect(getFeedbackDetail('missing', 'org-a')).rejects.toThrow(NotFoundError);
  });

  it('returns the feedback when owned by the org', async () => {
    // assertFeedbackInOrg lookup + getFeedbackDetail lookup both use findUnique
    mockPrisma.feedback.findUnique
      .mockResolvedValueOnce({ id: 'fb-own', project: { org_id: 'org-a' } })
      .mockResolvedValueOnce({
        id: 'fb-own',
        attachments: [],
        replies: [],
        feedbackTags: [],
        project: { id: 'proj-a', name: 'P', slug: 'p' },
      });

    const detail = await getFeedbackDetail('fb-own', 'org-a');
    expect(detail.id).toBe('fb-own');
  });
});
