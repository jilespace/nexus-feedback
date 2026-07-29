import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  feedback: { findUnique: vi.fn() },
  notificationPreference: { findMany: vi.fn() },
  member: { findMany: vi.fn() },
};

vi.mock('../../db/client.js', () => ({ prisma: mockPrisma }));

vi.mock('../email.js', () => ({
  sendEmail: vi.fn(),
  sendBatchEmails: vi.fn(),
}));

const { notifyStatusChange, notifyNewFeedback, notifyReply } = await import('../notification.js');
const { sendEmail, sendBatchEmails } = await import('../email.js');

describe('Notification Service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('notifyStatusChange sends emails to voters and contact', async () => {
    mockPrisma.feedback.findUnique.mockResolvedValue({
      id: 'fb_1', title: 'Test', project_id: 'p1',
      contact: 'user@example.com', votes: [{ email: 'voter@example.com' }],
    });
    mockPrisma.notificationPreference.findMany.mockResolvedValue([]);

    await notifyStatusChange('fb_1', 'resolved');
    expect(sendBatchEmails).toHaveBeenCalledWith(
      ['user@example.com', 'voter@example.com'],
      expect.any(String),
      expect.any(String),
    );
  });

  it('notifyStatusChange respects opt-out preferences', async () => {
    mockPrisma.feedback.findUnique.mockResolvedValue({
      id: 'fb_1', title: 'Test', project_id: 'p1',
      contact: 'user@example.com', votes: [],
    });
    mockPrisma.notificationPreference.findMany.mockResolvedValue([
      { email: 'user@example.com', status_updates: false },
    ]);

    await notifyStatusChange('fb_1', 'resolved');
    expect(sendBatchEmails).not.toHaveBeenCalled();
  });

  it('notifyReply sends email to feedback contact', async () => {
    mockPrisma.feedback.findUnique.mockResolvedValue({
      id: 'fb_1', title: 'Test', contact: 'user@example.com',
    });

    await notifyReply('fb_1', 'Reply content');
    expect(sendEmail).toHaveBeenCalledWith(
      'user@example.com',
      expect.stringContaining('Test'),
      expect.stringContaining('Reply content'),
    );
  });

  it('notifyNewFeedback sends emails to org owners and admins', async () => {
    mockPrisma.feedback.findUnique.mockResolvedValue({
      id: 'fb_1', title: 'New Idea', category: 'feature',
    });
    mockPrisma.member.findMany.mockResolvedValue([
      { email: 'owner@example.com' },
      { email: 'admin@example.com' },
    ]);

    await notifyNewFeedback('fb_1', 'org_1');
    expect(sendBatchEmails).toHaveBeenCalledWith(
      ['owner@example.com', 'admin@example.com'],
      expect.stringContaining('New Idea'),
      expect.stringContaining('feature'),
    );
  });
});
