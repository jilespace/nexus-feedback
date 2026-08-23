import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  feedback: { findMany: vi.fn() },
};

vi.mock('../../db/client.js', () => ({ prisma: mockPrisma }));

const { exportFeedbackCSV } = await import('../export.js');

describe('exportFeedbackCSV sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefixes formula-like titles with a single quote', async () => {
    vi.mocked(mockPrisma.feedback.findMany).mockResolvedValue([
      {
        id: 'fb_1',
        title: '=HYPERLINK("http://evil")',
        content: 'normal content',
        category: 'bug',
        priority: 'high',
        status: 'open',
        vote_count: 1,
        source: 'board',
        contact: null,
        feedbackTags: [],
        assignee: null,
        created_at: new Date('2026-01-01T00:00:00Z'),
      },
    ] as never);

    const csv = await exportFeedbackCSV({}, 'org1');

    expect(csv).toContain('"\'=HYPERLINK');
  });

  it('prefixes formula-like contact values with a single quote', async () => {
    vi.mocked(mockPrisma.feedback.findMany).mockResolvedValue([
      {
        id: 'fb_2',
        title: 'plain title',
        content: '@cmd injection',
        category: 'bug',
        priority: 'high',
        status: 'open',
        vote_count: 1,
        source: 'board',
        contact: '+8613800000000',
        feedbackTags: [],
        assignee: null,
        created_at: new Date('2026-01-01T00:00:00Z'),
      },
    ] as never);

    const csv = await exportFeedbackCSV({}, 'org1');

    expect(csv).toContain('\'@cmd injection');
    expect(csv).toContain('\'+8613800000000');
  });

  it('leaves normal values untouched', async () => {
    vi.mocked(mockPrisma.feedback.findMany).mockResolvedValue([
      {
        id: 'fb_3',
        title: '普通标题',
        content: '普通内容',
        category: 'bug',
        priority: 'high',
        status: 'open',
        vote_count: 1,
        source: 'board',
        contact: null,
        feedbackTags: [],
        assignee: null,
        created_at: new Date('2026-01-01T00:00:00Z'),
      },
    ] as never);

    const csv = await exportFeedbackCSV({}, 'org1');

    expect(csv).toContain('普通标题');
    expect(csv).not.toContain('\'普通标题');
  });
});
